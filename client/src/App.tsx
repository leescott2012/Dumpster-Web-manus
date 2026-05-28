import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import ErrorToaster from "./components/ErrorToaster";
import { ThemeProvider } from "./contexts/ThemeContext";
import { installGlobalBugHandlers } from "./lib/bugLogger";
import Home from "./pages/Home";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Admin from "./pages/Admin";

function Router() {
  return (
    <Switch>
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/admin" component={Admin} />
      <Route path="/" component={Home} />
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
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
