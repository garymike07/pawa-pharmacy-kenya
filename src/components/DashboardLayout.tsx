import { ReactNode, useEffect, useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  FileText,
  Truck,
  LogOut,
  Pill,
  Menu,
  X,
} from "lucide-react";
import { toast } from "sonner";

interface DashboardLayoutProps {
  children: ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [userEmail, setUserEmail] = useState<string>("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserEmail(user.email || "");
      }
    });
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out successfully");
    navigate("/auth");
  };

  const navItems = [
    { path: "/", icon: LayoutDashboard, label: "Dashboard" },
    { path: "/inventory", icon: Package, label: "Inventory" },
    { path: "/sales", icon: ShoppingCart, label: "Sales" },
    { path: "/prescriptions", icon: FileText, label: "Prescriptions" },
    { path: "/suppliers", icon: Truck, label: "Suppliers" },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="relative flex min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.15),transparent_55%),radial-gradient(circle_at_bottom,rgba(236,72,153,0.12),transparent_60%)]" />

      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 rounded-full bg-white/15 p-2 text-white shadow-lg backdrop-blur-md transition hover:bg-white/25"
      >
        {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      <aside
        className={`${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        } glass-panel fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-sidebar-background/60 text-sidebar-foreground shadow-2xl transition-transform duration-300 ease-in-out lg:static lg:translate-x-0`}
      >
        <div className="border-b border-white/10 p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-accent shadow-inner">
              <Pill className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-wide">Pawa Pharmacy</h1>
              <p className="text-xs uppercase tracking-[0.35em] text-white/60">Management Suite</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto p-4">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileMenuOpen(false)}
              className={`group flex items-center gap-4 rounded-xl px-4 py-3 text-sm font-medium tracking-wide transition ${
                isActive(item.path)
                  ? "bg-white/20 text-white shadow-[0_15px_45px_-25px_rgba(59,130,246,0.8)]"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span className={`flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/10 transition ${
                isActive(item.path) ? "border-white/30 bg-white/20" : "group-hover:border-white/20"
              }`}>
                <item.icon className="h-4 w-4" />
              </span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="border-t border-white/10 p-5">
          <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
            <p className="text-xs uppercase tracking-[0.2em] text-white/40">Signed in</p>
            <p className="truncate text-base font-semibold text-white">{userEmail}</p>
          </div>
          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-full justify-center gap-3 rounded-xl border-white/20 bg-white/10 text-white hover:bg-white/20"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </aside>

      <main className="relative z-10 flex min-h-screen flex-1 flex-col overflow-hidden lg:ml-72">
        <div className="flex-1 overflow-y-auto px-4 pb-12 pt-20 sm:px-6 lg:px-12 lg:pt-12">
          <div className="mx-auto max-w-7xl space-y-10 animate-fade-in">
            {children}
          </div>
        </div>
      </main>

      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </div>
  );
};

export default DashboardLayout;
