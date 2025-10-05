import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ShoppingCart, Trash2 } from "lucide-react";

type MedicineOption = {
  id: string;
  name: string;
  selling_price: number;
  quantity: number;
};

type PrescriptionOption = {
  id: string;
  prescription_number: string;
  patient_name: string;
};

type SaleItemInput = {
  medicineId: string;
  name: string;
  quantity: number;
  unitPrice: number;
};

type SaleHistoryEntry = {
  id: string;
  sale_number: string | null;
  total_amount: number;
  payment_method: string;
  customer_name: string | null;
  created_at: string | null;
  sale_items: {
    id: string;
    quantity: number;
    total_price: number;
    medicines?: {
      name: string;
    } | null;
  }[];
};

const saleFormSchema = z.object({
  customerName: z.string().min(2, "Name is too short").optional().or(z.literal("")),
  customerPhone: z
    .string()
    .regex(/^\+?[0-9\s-]*$/, "Invalid phone number")
    .optional()
    .or(z.literal("")),
  paymentMethod: z.enum(["cash", "mpesa", "card", "insurance"]),
  prescriptionId: z.string().optional().or(z.literal("")),
});

type SaleFormValues = z.infer<typeof saleFormSchema>;

const fetchMedicines = async (): Promise<MedicineOption[]> => {
  const { data, error } = await supabase
    .from("medicines")
    .select("id, name, selling_price, quantity")
    .order("name");

  if (error) throw error;
  return data || [];
};

const fetchPrescriptions = async (): Promise<PrescriptionOption[]> => {
  const { data, error } = await supabase
    .from("prescriptions")
    .select("id, prescription_number, patient_name")
    .order("prescription_date", { ascending: false })
    .limit(50);

  if (error) throw error;
  return data || [];
};

const fetchSalesHistory = async (): Promise<SaleHistoryEntry[]> => {
  const { data, error } = await supabase
    .from("sales")
    .select(
      `id, sale_number, total_amount, payment_method, customer_name, created_at,
      sale_items ( id, quantity, total_price, medicines ( name ) )`
    )
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) throw error;

  return (data as SaleHistoryEntry[]) || [];
};

const Sales = () => {
  const queryClient = useQueryClient();

  const form = useForm<SaleFormValues>({
    resolver: zodResolver(saleFormSchema),
    defaultValues: {
      customerName: "",
      customerPhone: "",
      paymentMethod: "cash",
      prescriptionId: "",
    },
  });

  const [saleItems, setSaleItems] = useState<SaleItemInput[]>([]);
  const [selectedMedicineId, setSelectedMedicineId] = useState("");
  const [itemQuantity, setItemQuantity] = useState(1);

  const {
    data: medicines = [],
    isLoading: loadingMedicines,
  } = useQuery({ queryKey: ["medicines"], queryFn: fetchMedicines });

  const { data: prescriptions = [], isLoading: loadingPrescriptions } = useQuery({
    queryKey: ["prescriptions"],
    queryFn: fetchPrescriptions,
  });

  const {
    data: salesHistory = [],
    isLoading: loadingSalesHistory,
  } = useQuery({ queryKey: ["sales"], queryFn: fetchSalesHistory });

  const selectedMedicine = useMemo(
    () => medicines.find((medicine) => medicine.id === selectedMedicineId) || null,
    [medicines, selectedMedicineId],
  );

  const totalAmount = useMemo(
    () => saleItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
    [saleItems],
  );

  const handleAddItem = () => {
    if (!selectedMedicine) {
      toast.error("Select a medicine to add");
      return;
    }

    if (itemQuantity <= 0) {
      toast.error("Quantity must be at least 1");
      return;
    }

    if (itemQuantity > selectedMedicine.quantity) {
      toast.error("Quantity exceeds available stock");
      return;
    }

    setSaleItems((prev) => {
      const existing = prev.find((item) => item.medicineId === selectedMedicine.id);

      if (existing) {
        const newQuantity = existing.quantity + itemQuantity;

        if (newQuantity > selectedMedicine.quantity) {
          toast.error("Total quantity exceeds available stock");
          return prev;
        }

        return prev.map((item) =>
          item.medicineId === selectedMedicine.id
            ? { ...item, quantity: newQuantity }
            : item,
        );
      }

      return [
        ...prev,
        {
          medicineId: selectedMedicine.id,
          name: selectedMedicine.name,
          quantity: itemQuantity,
          unitPrice: selectedMedicine.selling_price,
        },
      ];
    });

    setSelectedMedicineId("");
    setItemQuantity(1);
  };

  const handleRemoveItem = (medicineId: string) => {
    setSaleItems((prev) => prev.filter((item) => item.medicineId !== medicineId));
  };

  const saleMutation = useMutation({
    mutationFn: async ({ formValues, items }: { formValues: SaleFormValues; items: SaleItemInput[] }) => {
      if (!items.length) {
        throw new Error("Add at least one medicine to the sale");
      }

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .insert({
          customer_name: formValues.customerName?.trim() || null,
          customer_phone: formValues.customerPhone?.trim() || null,
          payment_method: formValues.paymentMethod,
          prescription_id: formValues.prescriptionId ? formValues.prescriptionId : null,
          total_amount: total,
          served_by: userData?.user?.id ?? null,
        })
        .select("id")
        .single();

      if (saleError) throw saleError;

      const saleItemsPayload = items.map((item) => ({
        sale_id: sale.id,
        medicine_id: item.medicineId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total_price: item.quantity * item.unitPrice,
      }));

      const { error: saleItemsError } = await supabase.from("sale_items").insert(saleItemsPayload);
      if (saleItemsError) throw saleItemsError;

      return sale.id;
    },
    onSuccess: () => {
      toast.success("Sale recorded successfully");
      form.reset({
        customerName: "",
        customerPhone: "",
        paymentMethod: "cash",
        prescriptionId: "",
      });
      setSaleItems([]);
      queryClient.invalidateQueries({ queryKey: ["medicines"] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
    },
    onError: (error) => {
      console.error("Failed to record sale", error);
      toast.error(error instanceof Error ? error.message : "Failed to record sale");
    },
  });

  const onSubmit = (values: SaleFormValues) => {
    if (saleItems.length === 0) {
      toast.error("Add at least one medicine to the sale");
      return;
    }

    saleMutation.mutate({ formValues: values, items: saleItems });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Sales & Dispensing</h1>
          <p className="text-muted-foreground mt-1">
            Record new sales and review recent transactions
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.6fr,1fr]">
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                New Sale
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="customerName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Customer Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Jane Doe" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="customerPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Customer Phone</FormLabel>
                          <FormControl>
                            <Input placeholder="0712 345 678" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="paymentMethod"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Payment Method</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select payment method" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="cash">Cash</SelectItem>
                              <SelectItem value="mpesa">M-Pesa</SelectItem>
                              <SelectItem value="card">Card</SelectItem>
                              <SelectItem value="insurance">Insurance</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="prescriptionId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Prescription</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value ?? ""}
                            disabled={loadingPrescriptions}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Optional" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="">No prescription</SelectItem>
                              {prescriptions.map((prescription) => (
                                <SelectItem key={prescription.id} value={prescription.id}>
                                  {prescription.prescription_number} — {prescription.patient_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-[2fr,1fr,auto]">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Medicine</label>
                        <Select
                          value={selectedMedicineId}
                          onValueChange={setSelectedMedicineId}
                          disabled={loadingMedicines || medicines.length === 0}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={loadingMedicines ? "Loading..." : "Select medicine"} />
                          </SelectTrigger>
                          <SelectContent>
                            {medicines.map((medicine) => (
                              <SelectItem key={medicine.id} value={medicine.id}>
                                {medicine.name} • {medicine.quantity} in stock
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Quantity</label>
                        <Input
                          type="number"
                          min={1}
                          value={itemQuantity}
                          onChange={(event) => setItemQuantity(Number(event.target.value) || 1)}
                        />
                      </div>
                      <div className="flex items-end">
                        <Button type="button" onClick={handleAddItem} disabled={!medicines.length} className="w-full">
                          Add Item
                        </Button>
                      </div>
                    </div>

                    {selectedMedicine && (
                      <p className="text-sm text-muted-foreground">
                        Selling price: KES {selectedMedicine.selling_price.toLocaleString()} • Available: {selectedMedicine.quantity}
                      </p>
                    )}

                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead>Medicine</TableHead>
                            <TableHead className="text-right">Quantity</TableHead>
                            <TableHead className="text-right">Unit Price</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead className="w-[80px]" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {saleItems.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                                No items added yet
                              </TableCell>
                            </TableRow>
                          ) : (
                            saleItems.map((item) => (
                              <TableRow key={item.medicineId}>
                                <TableCell className="font-medium">{item.name}</TableCell>
                                <TableCell className="text-right">{item.quantity}</TableCell>
                                <TableCell className="text-right">KES {item.unitPrice.toLocaleString()}</TableCell>
                                <TableCell className="text-right font-semibold">
                                  KES {(item.quantity * item.unitPrice).toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleRemoveItem(item.medicineId)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-lg font-semibold">
                        Total: <span className="text-primary">KES {totalAmount.toLocaleString()}</span>
                      </p>
                      <Button type="submit" disabled={saleMutation.isPending}>
                        {saleMutation.isPending ? "Saving..." : "Complete Sale"}
                      </Button>
                    </div>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Sales</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Sale #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead className="text-right">Total (KES)</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingSalesHistory ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-6">
                          Loading sales...
                        </TableCell>
                      </TableRow>
                    ) : salesHistory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                          No sales recorded yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      salesHistory.map((sale) => {
                        const itemsSummary = sale.sale_items
                          ?.map((item) => `${item.medicines?.name ?? "Item"} ×${item.quantity}`)
                          .join(" • ");

                        return (
                          <TableRow key={sale.id}>
                            <TableCell className="font-medium">{sale.sale_number ?? "Pending"}</TableCell>
                            <TableCell>{sale.customer_name ?? "Walk-in"}</TableCell>
                            <TableCell className="text-right font-semibold">
                              {Number(sale.total_amount).toLocaleString()}
                            </TableCell>
                            <TableCell className="uppercase text-xs font-semibold text-muted-foreground">
                              {sale.payment_method}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span>{sale.created_at ? new Date(sale.created_at).toLocaleString() : ""}</span>
                                {itemsSummary && (
                                  <span className="text-xs text-muted-foreground mt-1">{itemsSummary}</span>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Sales;
