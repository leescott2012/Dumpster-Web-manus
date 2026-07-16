import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import { Analytics } from "@vercel/analytics/react";
import ErrorBoundary from "./components/ErrorBoundary";
import ErrorToaster from "./components/ErrorToaster";
import { ThemeProvider } from "./contexts/ThemeContext";
import { installGlobalBugHandlers } from "./lib/bugLogger";
import Home from "./pages/Home";
import LandingPage from "./pages/LandingPage";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Admin from "./pages/Admin";

/**
 * "/" gate: marketing landing page for brand-new visitors ONLY.
 * Anyone mid-auth or already signed in must reach the app unchanged:
 *  - magic links redirect to "/" with tokens (or errors) in the hash — the
 *    Supabase client in the app processes them, so those loads render Home;
 *  - an existing session lives in localStorage under "sb-<ref>-auth-token".
 */
function RootGate() {
  const hash = window.location.hash;
  const isAuthCallback =
    hash.includes("access_token") || hash.includes("token_hash") ||
    hash.includes("error") || hash.includes("type=");
  let hasSession = false;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) || "";
      if (k.startsWith("sb-") && k.endsWith("-auth-token")) { hasSession = true; break; }
    }
  } catch { /* storage blocked — treat as new visitor */ }
  return isAuthCallback || hasSession ? <Home /> : <LandingPage />;
}

function Router() {
  return (
    <Switch>
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/admin" component={Admin} />
      <Route path="/app" component={Home} />
      <Route path="/" component={RootGate} />
      <Route component={Home} />
    </Switch>
  );
}

function App() {
  // Capture uncaught window errors + unhandled promise rejections → bug log.
  useEffect(() => { installGlobalBugHandlers(); }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster
            position="bottom-center"
            toastOptions={{
              style: {
                background: "#151515",
                border: "1px solid #1e1e1e",
                color: "#e8e8e8",
                fontSize: "13px",
              },
            }}
          />
          <Router />
          {/* Visible red error notifier with "Send to bug log" button.
              Mounted once at the top so it's available on every route. */}
          <ErrorToaster />
          <Analytics />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
