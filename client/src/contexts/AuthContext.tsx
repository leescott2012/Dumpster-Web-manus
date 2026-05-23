/**
 * AuthContext — global auth + credits state
 * Wraps Supabase auth, fetches user profile + credits,
 * exposes login/logout/signup and credit helpers.
 */
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { syncAIProfileOnSignIn } from "@/lib/aiProfileSync";
import { setCurrentUserId } from "@/lib/currentUser";
import type { User, Session } from "@supabase/supabase-js";

export interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
  subscription_tier: "free" | "pro";
  credits: number;
  daily_credits_remaining: number;
  daily_credits_reset_at: string;
  referral_code: string;
  lifetime_purchase: boolean;
  stripe_customer_id: string | null;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  /** Total available = purchased credits + daily remaining */
  totalCredits: number;
  /** Sign up with email + password */
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  /** Sign in with email + password */
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  /** Sign in with Google OAuth */
  signInWithGoogle: () => Promise<{ error: string | null }>;
  /** Sign in with Apple OAuth */
  signInWithApple: () => Promise<{ error: string | null }>;
  /** Sign in with Facebook OAuth */
  signInWithFacebook: () => Promise<{ error: string | null }>;
  /** Sign out */
  signOut: () => Promise<void>;
  /** Refresh profile + credits from DB */
  refreshProfile: () => Promise<void>;
  /** Check if user can afford an AI action */
  canAfford: (action: string) => boolean;
  /** Deduct credits for an action (call after AI completes) */
  useCredits: (action: string) => Promise<boolean>;
}

var AuthCtx = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  var ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}

// Credit costs (duplicated from credits.ts to avoid circular imports in server)
var COSTS: Record<string, number> = {
  ai_caption_casual: 3,
  ai_caption_pro: 8,
  ai_suggest: 15,
  ai_recycle: 5,
  ai_chat: 2,
  ai_vibe: 5,
  ai_rescan_batch: 20,
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  var [user, setUser] = useState<User | null>(null);
  var [session, setSession] = useState<Session | null>(null);
  var [profile, setProfile] = useState<UserProfile | null>(null);
  var [loading, setLoading] = useState(true);

  // Fetch profile from Supabase
  var fetchProfile = useCallback(async function(userId: string) {
    var { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (!error && data) {
      // Check if daily credits need reset (24h elapsed)
      var resetAt = new Date(data.daily_credits_reset_at);
      var now = new Date();
      if (now.getTime() - resetAt.getTime() > 24 * 60 * 60 * 1000) {
        var dailyAmount = data.subscription_tier === "pro" ? 200 : 15;
        await supabase
          .from("profiles")
          .update({ daily_credits_remaining: dailyAmount, daily_credits_reset_at: now.toISOString() })
          .eq("id", userId);
        data.daily_credits_remaining = dailyAmount;
        data.daily_credits_reset_at = now.toISOString();
      }
      setProfile(data as UserProfile);
    }
  }, []);

  // Listen to auth changes
  useEffect(function() {
    // Get initial session
    supabase.auth.getSession().then(function({ data: { session: s } }) {
      setSession(s);
      setUser(s?.user ?? null);
      setCurrentUserId(s?.user?.id ?? null);
      if (s?.user) {
        fetchProfile(s.user.id);
        // Sync cloud AI memory into localStorage (taste/rules/captions).
        // Photos and dumps stay local — only the user-level AI knowledge syncs.
        syncAIProfileOnSignIn(s.user.id).catch(function(e) {
          console.warn("[AuthContext] AI profile sync failed:", e);
        });
      }
      setLoading(false);
    });

    // Subscribe to changes
    var { data: { subscription } } = supabase.auth.onAuthStateChange(function(_event, s) {
      setSession(s);
      setUser(s?.user ?? null);
      setCurrentUserId(s?.user?.id ?? null);
      if (s?.user) {
        fetchProfile(s.user.id);
        syncAIProfileOnSignIn(s.user.id).catch(function(e) {
          console.warn("[AuthContext] AI profile sync failed:", e);
        });
      } else {
        setProfile(null);
      }
    });

    return function() { subscription.unsubscribe(); };
  }, [fetchProfile]);

  var signUp = useCallback(async function(email: string, password: string) {
    var { error } = await supabase.auth.signUp({ email: email, password: password });
    return { error: error ? error.message : null };
  }, []);

  var signIn = useCallback(async function(email: string, password: string) {
    var { error } = await supabase.auth.signInWithPassword({ email: email, password: password });
    return { error: error ? error.message : null };
  }, []);

  var signInWithGoogle = useCallback(async function() {
    var { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    return { error: error ? error.message : null };
  }, []);

  var signInWithApple = useCallback(async function() {
    var { error } = await supabase.auth.signInWithOAuth({
      provider: "apple",
      options: { redirectTo: window.location.origin },
    });
    return { error: error ? error.message : null };
  }, []);

  var signInWithFacebook = useCallback(async function() {
    var { error } = await supabase.auth.signInWithOAuth({
      provider: "facebook",
      options: { redirectTo: window.location.origin },
    });
    return { error: error ? error.message : null };
  }, []);

  var signOut = useCallback(async function() {
    // Clear the per-user "already cleared demo" flag so next sign-in starts fresh
    if (user) {
      try { localStorage.removeItem("dumpster_cleared_" + user.id); } catch {}
    }
    await supabase.auth.signOut();
    setProfile(null);
  }, [user]);

  var refreshProfile = useCallback(async function() {
    if (user) await fetchProfile(user.id);
  }, [user, fetchProfile]);

  var totalCredits = profile ? profile.credits + profile.daily_credits_remaining : 0;

  var canAfford = useCallback(function(action: string) {
    var cost = COSTS[action] || 0;
    return totalCredits >= cost;
  }, [totalCredits]);

  var useCredits = useCallback(async function(action: string) {
    if (!profile) return false;
    var cost = COSTS[action] || 0;
    if (totalCredits < cost) return false;

    // Deduct: daily first, then purchased
    var fromDaily = Math.min(cost, profile.daily_credits_remaining);
    var fromPurchased = cost - fromDaily;

    var { error } = await supabase
      .from("profiles")
      .update({
        credits: profile.credits - fromPurchased,
        daily_credits_remaining: profile.daily_credits_remaining - fromDaily,
      })
      .eq("id", profile.id);

    if (error) return false;

    // Log transaction
    await supabase.from("credit_transactions").insert({
      user_id: profile.id,
      amount: -cost,
      type: action,
      description: "Used " + cost + " credits for " + action,
    });

    // Update local state
    setProfile(function(prev) {
      if (!prev) return prev;
      return {
        ...prev,
        credits: prev.credits - fromPurchased,
        daily_credits_remaining: prev.daily_credits_remaining - fromDaily,
      };
    });

    return true;
  }, [profile, totalCredits]);

  var value: AuthState = {
    user: user,
    session: session,
    profile: profile,
    loading: loading,
    totalCredits: totalCredits,
    signUp: signUp,
    signIn: signIn,
    signInWithGoogle: signInWithGoogle,
    signInWithApple: signInWithApple,
    signInWithFacebook: signInWithFacebook,
    signOut: signOut,
    refreshProfile: refreshProfile,
    canAfford: canAfford,
    useCredits: useCredits,
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
