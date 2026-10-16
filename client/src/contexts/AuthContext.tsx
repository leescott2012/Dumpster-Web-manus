/**
 * AuthContext — global auth + credits state
 * Wraps Supabase auth, fetches user profile + credits,
 * exposes login/logout/signup and credit helpers.
 */
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { syncAIProfileOnSignIn, ensureAIProfileWired } from "@/lib/aiProfileSync";
import { setCurrentUserId } from "@/lib/currentUser";
import { CREDIT_COSTS } from "@/lib/credits";
import { onCreditChange } from "@/lib/creditSync";
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
  username: string | null;
  avatar_icon: string | null;
  avatar_color: string | null;
  /** Set once first-run setup is finished. Null = show OnboardingFlow. */
  onboarding_completed_at: string | null;
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
}

var AuthCtx = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  var ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}

// Credit costs come from credits.ts (it has no imports, so no circular-import
// risk). Keep credits.ts in sync with server/creditGate.ts COSTS.
var COSTS = CREDIT_COSTS;

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
        // Display only — the server (deduct_credits) performs the real reset. The browser
        // can no longer write credit columns (profiles UPDATE is limited to harmless fields).
        var dailyAmount = data.subscription_tier === "pro" ? 200 : 15;
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
        ensureAIProfileWired();
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
        ensureAIProfileWired();
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

  // Keep the badge in sync after every AI call (aiFetch) and when the tab
  // regains focus (another tab/device may have spent credits).
  var userId = user ? user.id : null;
  useEffect(function() {
    if (!userId) return;
    var uid = userId;
    var timers: ReturnType<typeof setTimeout>[] = [];
    var off = onCreditChange(function(remaining) {
      if (remaining === null) {
        // Failure/refund path: the server refunds after responding, so read
        // now and once more after the refund has had time to land.
        fetchProfile(uid);
        timers.push(setTimeout(function() { fetchProfile(uid); }, 2500));
        return;
      }
      setProfile(function(p) {
        if (!p) return p;
        // Server spends daily first, then purchased — mirror that split.
        var spent = Math.max(0, p.credits + p.daily_credits_remaining - remaining);
        var daily = Math.max(0, p.daily_credits_remaining - spent);
        return { ...p, daily_credits_remaining: daily, credits: remaining - daily };
      });
    });
    function onVisible() {
      if (document.visibilityState === "visible") fetchProfile(uid);
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return function() {
      off();
      timers.forEach(clearTimeout);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [userId, fetchProfile]);

  var totalCredits = profile ? profile.credits + profile.daily_credits_remaining : 0;

  var canAfford = useCallback(function(action: string) {
    var cost = COSTS[action] || 0;
    return totalCredits >= cost;
  }, [totalCredits]);


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
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
