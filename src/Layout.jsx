import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { LayoutDashboard, PlayCircle, Activity, FileBarChart, Settings, ShoppingBag } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

const navigationItems = [
  {
    title: "Dashboard",
    url: createPageUrl("Dashboard"),
    icon: LayoutDashboard,
  },
  {
    title: "New Prediction",
    url: createPageUrl("NewPrediction"),
    icon: PlayCircle,
  },
  {
    title: "Job Monitor",
    url: createPageUrl("JobMonitor"),
    icon: Activity,
  },
  {
    title: "Reports",
    url: createPageUrl("Reports"),
    icon: FileBarChart,
  },
];

export default function Layout({ children }) {
  const location = useLocation();

  return (
    <SidebarProvider>
      <style>{`
        :root {
          --retail-blue: #1e5b8f;
          --retail-blue-light: #5b9bd5;
          --retail-blue-dark: #14476e;
          --retail-accent: #00b4d8;
          --retail-success: #06d6a0;
          --retail-warning: #ffd166;
          --retail-error: #ef476f;
        }
      `}</style>
      <div className="min-h-screen flex w-full" style={{ background: "linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)" }}>
        <Sidebar className="border-r" style={{ borderColor: "var(--retail-blue-light)" }}>
          <SidebarHeader className="border-b p-6" style={{ borderColor: "var(--retail-blue-light)", background: "linear-gradient(135deg, var(--retail-blue) 0%, var(--retail-blue-dark) 100%)" }}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "white" }}>
                <ShoppingBag className="w-7 h-7" style={{ color: "var(--retail-blue)" }} />
              </div>
              <div>
                <h2 className="font-bold text-xl text-white">Retail Genie</h2>
                <p className="text-xs text-blue-100">Prediction Platform</p>
              </div>
            </div>
          </SidebarHeader>
          
          <SidebarContent className="p-3">
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider px-3 py-2" style={{ color: "var(--retail-blue)" }}>
                Navigation
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navigationItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild 
                        className={`hover:bg-blue-50 transition-all duration-200 rounded-lg mb-1 ${
                          location.pathname === item.url ? 'text-white shadow-md' : ''
                        }`}
                        style={location.pathname === item.url ? {
                          background: "linear-gradient(135deg, var(--retail-blue-light) 0%, var(--retail-blue) 100%)"
                        } : {}}
                      >
                        <Link to={item.url} className="flex items-center gap-3 px-4 py-3">
                          <item.icon className="w-5 h-5" />
                          <span className="font-medium">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="border-t p-4" style={{ borderColor: "var(--retail-blue-light)" }}>
            <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "rgba(91, 155, 213, 0.1)" }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-white" style={{ background: "var(--retail-blue)" }}>
                {(window.userEmail || "U")[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate" style={{ color: "var(--retail-blue-dark)" }}>Business User</p>
                <p className="text-xs truncate" style={{ color: "var(--retail-blue-light)" }}>Microsoft Fabric</p>
              </div>
            </div>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col">
          <header className="bg-white border-b px-6 py-4 md:hidden shadow-sm" style={{ borderColor: "var(--retail-blue-light)" }}>
            <div className="flex items-center gap-4">
              <SidebarTrigger className="hover:bg-blue-50 p-2 rounded-lg transition-colors" />
              <h1 className="text-xl font-bold" style={{ color: "var(--retail-blue)" }}>Retail Genie</h1>
            </div>
          </header>

          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}