import { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  BarChart3,
  CreditCard,
  Settings,
  User,
  FileText,
  DollarSign,
  Bell,
  HelpCircle,
  Shield,
  LayoutDashboard,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

const mainItems = [
  { title: "Overview", url: "/dashboard", icon: LayoutDashboard },
  { title: "Transactions", url: "/dashboard/transactions", icon: CreditCard },
  { title: "Payouts", url: "/dashboard/payouts", icon: DollarSign },
  { title: "Reports", url: "/dashboard/reports", icon: BarChart3 },
];

const settingsItems = [
  { title: "Profile", url: "/dashboard/profile", icon: User },
  { title: "Settings", url: "/dashboard/settings", icon: Settings },
  { title: "Notifications", url: "/dashboard/notifications", icon: Bell },
  { title: "Help", url: "/dashboard/help", icon: HelpCircle },
];

export function DashboardSidebar() {
  const { state } = useSidebar();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const location = useLocation();
  const currentPath = location.pathname;
  const collapsed = state === "collapsed";

  useEffect(() => {
    if (user) {
      checkAdminStatus();
    }
  }, [user]);

  const checkAdminStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user?.id)
        .eq('role', 'admin')
        .single();

      if (!error && data) {
        setIsAdmin(true);
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
    }
  };

  const isActive = (path: string) => {
    if (path === "/dashboard") {
      return currentPath === "/dashboard";
    }
    return currentPath.startsWith(path);
  };

  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive 
      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" 
      : "hover:bg-sidebar-accent/50";

  return (
    <Sidebar className={collapsed ? "w-14" : "w-64"} collapsible="icon">
      <SidebarContent>
        {/* Logo/Brand */}
        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center space-x-2">
            <CreditCard className="h-8 w-8 text-sidebar-primary" />
            {!collapsed && (
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-sidebar-foreground">Jezdene</h1>
                {isAdmin && <Shield className="h-5 w-5 text-primary" />}
              </div>
            )}
          </div>
        </div>

        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>Dashboard</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end={item.url === "/dashboard"} className={getNavCls}>
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Settings Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className={getNavCls}>
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}