import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "./lib/protected-route";
import { ProxyCheckProgress } from "@/components/ProxyCheckProgress";
import HomePage from "@/pages/home-page";
import ServersPage from "@/pages/servers-page";
import AttacksPage from "@/pages/attacks-page";
import ProxiesPage from "@/pages/proxies-page";
import SettingsPage from "@/pages/settings-page";
import AuthPage from "@/pages/auth-page";
import NotFound from "@/pages/not-found";
function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={HomePage} />
      <ProtectedRoute path="/servers" component={ServersPage} />
      <ProtectedRoute path="/attacks" component={AttacksPage} />
      <ProtectedRoute path="/proxies" component={ProxiesPage} />
      <ProtectedRoute path="/settings" component={SettingsPage} />
      <Route path="/auth" component={AuthPage} />
      <Route component={NotFound} />
    </Switch>
  );
}
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <div className="min-h-screen bg-background">
          <Router />
          <Toaster />
          <ToastContainer position="bottom-right" />
        </div>
      </AuthProvider>
    </QueryClientProvider>
  );
}