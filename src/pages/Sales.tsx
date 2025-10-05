import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart } from "lucide-react";

const Sales = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Sales & Dispensing</h1>
          <p className="text-muted-foreground mt-1">Process new sales and view history</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              New Sale
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Sales module coming soon - Process transactions and manage customer purchases
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Sales;
