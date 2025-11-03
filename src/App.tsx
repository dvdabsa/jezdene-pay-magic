import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import Payouts from "./pages/Payouts";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Notifications from "./pages/Notifications";
import Help from "./pages/Help";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import Accounts from "./pages/Accounts";
import Transfer from "./pages/Transfer";
import PaymentSuccess from "./pages/PaymentSuccess";

const queryClient = new QueryClient();

// Layout component for dashboard pages
const DashboardLayout = ({ children }: { children: React.ReactNode }) => (
  <SidebarProvider>
    <div className="min-h-screen flex w-full">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col">
        <header className="h-12 flex items-center border-b border-border bg-background px-4">
          <SidebarTrigger />
        </header>
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  </SidebarProvider>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<DashboardLayout><Dashboard /></DashboardLayout>} />
            <Route path="/dashboard/accounts" element={<DashboardLayout><Accounts /></DashboardLayout>} />
            <Route path="/dashboard/transfer" element={<DashboardLayout><Transfer /></DashboardLayout>} />
            <Route path="/dashboard/transactions" element={<DashboardLayout><Transactions /></DashboardLayout>} />
            <Route path="/payment/success" element={<PaymentSuccess />} />
            <Route path="/dashboard/payouts" element={<DashboardLayout><Payouts /></DashboardLayout>} />
            <Route path="/dashboard/reports" element={<DashboardLayout><Reports /></DashboardLayout>} />
            <Route path="/dashboard/settings" element={<DashboardLayout><Settings /></DashboardLayout>} />
            <Route path="/dashboard/notifications" element={<DashboardLayout><Notifications /></DashboardLayout>} />
            <Route path="/dashboard/help" element={<DashboardLayout><Help /></DashboardLayout>} />
            <Route path="/dashboard/profile" element={<DashboardLayout><Profile /></DashboardLayout>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
