import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Search, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface Medicine {
  id: string;
  name: string;
  generic_name: string | null;
  batch_number: string;
  quantity: number;
  reorder_level: number;
  selling_price: number;
  expiry_date: string;
  requires_prescription: boolean;
}

const Inventory = () => {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMedicines();
  }, []);

  const loadMedicines = async () => {
    try {
      const { data, error } = await supabase
        .from("medicines")
        .select("*")
        .order("name");

      if (error) throw error;
      setMedicines(data || []);
    } catch (error: any) {
      toast.error("Failed to load medicines");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const filteredMedicines = medicines.filter(
    (medicine) =>
      medicine.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      medicine.generic_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      medicine.batch_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isExpiringSoon = (expiryDate: string) => {
    const today = new Date();
    const expiry = new Date(expiryDate);
    const ninetyDaysFromNow = new Date();
    ninetyDaysFromNow.setDate(today.getDate() + 90);
    return expiry <= ninetyDaysFromNow && expiry >= today;
  };

  const isExpired = (expiryDate: string) => {
    return new Date(expiryDate) < new Date();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Inventory Management</h1>
            <p className="text-muted-foreground mt-1">
              Manage medicines and stock levels
            </p>
          </div>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Add Medicine
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search medicines..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Name</TableHead>
                <TableHead>Generic Name</TableHead>
                <TableHead>Batch No.</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Price (KES)</TableHead>
                <TableHead>Expiry Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredMedicines.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    No medicines found
                  </TableCell>
                </TableRow>
              ) : (
                filteredMedicines.map((medicine) => (
                  <TableRow key={medicine.id}>
                    <TableCell className="font-medium">{medicine.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {medicine.generic_name || "-"}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {medicine.batch_number}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={
                          medicine.quantity <= medicine.reorder_level
                            ? "text-destructive font-semibold"
                            : ""
                        }
                      >
                        {medicine.quantity}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {medicine.selling_price.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {new Date(medicine.expiry_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {medicine.quantity <= medicine.reorder_level && (
                          <Badge variant="destructive" className="w-fit">
                            Low Stock
                          </Badge>
                        )}
                        {isExpired(medicine.expiry_date) && (
                          <Badge variant="destructive" className="w-fit">
                            Expired
                          </Badge>
                        )}
                        {isExpiringSoon(medicine.expiry_date) &&
                          !isExpired(medicine.expiry_date) && (
                            <Badge variant="outline" className="w-fit border-warning text-warning">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Expiring Soon
                            </Badge>
                          )}
                        {medicine.requires_prescription && (
                          <Badge variant="secondary" className="w-fit">
                            Rx Required
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Inventory;
