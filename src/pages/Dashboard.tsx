import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Package,
  ShoppingCart,
  AlertTriangle,
  TrendingUp,
  DollarSign,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalMedicines: 0,
    lowStockItems: 0,
    todaySales: 0,
    todayRevenue: 0,
    expiringItems: 0,
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardStats();
  }, []);

  const loadDashboardStats = async () => {
    try {
      // Total medicines
      const { count: medicinesCount } = await supabase
        .from("medicines")
        .select("*", { count: "exact", head: true });

      // Low stock items
      const { data: medicines } = await supabase
        .from("medicines")
        .select("quantity, reorder_level");

      const lowStock = medicines?.filter(
        (m) => m.quantity <= m.reorder_level
      ).length || 0;

      // Today's sales
      const today = new Date().toISOString().split("T")[0];
      const { count: salesCount, data: salesData } = await supabase
        .from("sales")
        .select("total_amount")
        .gte("created_at", today);

      const revenue = salesData?.reduce((sum, sale) => sum + Number(sale.total_amount), 0) || 0;

      // Expiring items (within 90 days)
      const ninetyDaysFromNow = new Date();
      ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);
      const { count: expiringCount } = await supabase
        .from("medicines")
        .select("*", { count: "exact", head: true })
        .lte("expiry_date", ninetyDaysFromNow.toISOString().split("T")[0])
        .gte("expiry_date", today);

      setStats({
        totalMedicines: medicinesCount || 0,
        lowStockItems: lowStock,
        todaySales: salesCount || 0,
        todayRevenue: revenue,
        expiringItems: expiringCount || 0,
      });
      setErrorMessage(null);
    } catch (error) {
      console.error("Error loading dashboard stats:", error);
      const message = (error as Error).message ?? "Could not load dashboard metrics.";
      setErrorMessage(
        message.toLowerCase().includes("schema cache")
          ? "Supabase schema is missing one or more dashboard tables. Apply the latest migrations and redeploy."
          : message,
      );
    }
  };

  const statCards = [
    {
      title: "Total Medicines",
      value: stats.totalMedicines,
      icon: Package,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Today's Sales",
      value: stats.todaySales,
      icon: ShoppingCart,
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
    {
      title: "Today's Revenue",
      value: `KES ${stats.todayRevenue.toLocaleString()}`,
      icon: DollarSign,
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      title: "Low Stock Items",
      value: stats.lowStockItems,
      icon: AlertTriangle,
      color: "text-warning",
      bgColor: "bg-warning/10",
    },
    {
      title: "Expiring Soon",
      value: stats.expiringItems,
      icon: TrendingUp,
      color: "text-destructive",
      bgColor: "bg-destructive/10",
    },
  ];

  return (
    <DashboardLayout>
      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 pb-16 pt-10 lg:px-12">
        <div className="max-w-4xl space-y-2">
          <p className="text-sm uppercase tracking-[0.4em] text-white/50">Overview</p>
          <h1 className="text-4xl font-black tracking-tight text-white">
            Performance Intelligence Dashboard
          </h1>
          <p className="text-base text-white/70">
            Monitor inventory health, real-time sales, and prescription activity across the pharmacy network.
          </p>
        </div>

        {errorMessage && (
          <Alert variant="destructive" className="border-destructive/40 bg-destructive/10 text-destructive-foreground">
            <AlertTitle>Dashboard metrics unavailable</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        <div className="fade-grid grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {statCards.map((stat, index) => (
            <Card
              key={index}
              className="glass-panel border border-white/10 p-0 transition hover:-translate-y-1"
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-semibold uppercase tracking-widest text-white/60">
                  {stat.title}
                </CardTitle>
                <div className={`rounded-xl p-2 shadow-inner ${stat.bgColor}`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black text-white">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="glass-panel border border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-lg font-semibold text-white">
              <span>Quick Actions</span>
              <span className="text-xs uppercase tracking-[0.3em] text-white/50">Navigate faster</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-3">
            {[{
              href: "/sales",
              icon: ShoppingCart,
              title: "Start New Sale",
              description: "Process transactions, capture payments, and automatically adjust stock.",
            },
            {
              href: "/inventory",
              icon: Package,
              title: "Inventory Console",
              description: "Register new medicines, monitor batches, and manage reorder levels.",
            },
            {
              href: "/prescriptions",
              icon: AlertTriangle,
              title: "Prescription Hub",
              description: "Record prescriptions, validate requirements, and track dispensing history.",
            }].map((action) => (
              <a
                key={action.href}
                href={action.href}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 transition duration-300 hover:-translate-y-1 hover:border-white/40"
              >
                <div className="pointer-events-none absolute inset-0 opacity-0 transition duration-300 group-hover:opacity-100" style={{ background: "radial-gradient(circle at top, rgba(59,130,246,0.35), transparent 55%)" }} />
                <div className="relative flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-primary shadow-inner">
                    <action.icon className="h-6 w-6" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-white">{action.title}</h3>
                    <p className="text-sm text-white/70">{action.description}</p>
                  </div>
                </div>
              </a>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
