import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    } catch (error) {
      console.error("Error loading dashboard stats:", error);
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
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Welcome to Pawa Pharmacy Management System
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {statCards.map((stat, index) => (
            <Card key={index} className="border-l-4 border-l-primary">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <a
              href="/sales"
              className="p-4 border rounded-lg hover:bg-muted transition-colors"
            >
              <ShoppingCart className="h-8 w-8 text-primary mb-2" />
              <h3 className="font-semibold">New Sale</h3>
              <p className="text-sm text-muted-foreground">Process a new sale</p>
            </a>
            <a
              href="/inventory"
              className="p-4 border rounded-lg hover:bg-muted transition-colors"
            >
              <Package className="h-8 w-8 text-primary mb-2" />
              <h3 className="font-semibold">Manage Inventory</h3>
              <p className="text-sm text-muted-foreground">
                Add or update medicines
              </p>
            </a>
            <a
              href="/prescriptions"
              className="p-4 border rounded-lg hover:bg-muted transition-colors"
            >
              <AlertTriangle className="h-8 w-8 text-primary mb-2" />
              <h3 className="font-semibold">Prescriptions</h3>
              <p className="text-sm text-muted-foreground">
                Manage prescriptions
              </p>
            </a>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
