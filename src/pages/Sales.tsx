import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Loader2, ReceiptText, ShoppingCart, Trash2 } from "lucide-react";

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
    isError: medicinesError,
    error: medicinesErrorDetails,
  } = useQuery({ queryKey: ["medicines"], queryFn: fetchMedicines });

  const {
    data: prescriptions = [],
    isLoading: loadingPrescriptions,
    isError: prescriptionsError,
    error: prescriptionsErrorDetails,
  } = useQuery({
    queryKey: ["prescriptions"],
    queryFn: fetchPrescriptions,
  });

  const {
    data: salesHistory = [],
    isLoading: loadingSalesHistory,
    isError: salesError,
    error: salesErrorDetails,
  } = useQuery({ queryKey: ["sales"], queryFn: fetchSalesHistory });

  const selectedMedicine = useMemo(
    () => medicines.find((medicine) => medicine.id === selectedMedicineId) || null,
    [medicines, selectedMedicineId],
  );

  const totalAmount = useMemo(
    () => saleItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
    [saleItems],
  );

  const formatDataError = (error: unknown, fallback: string) => {
    if (!error) return fallback;
    const message = (error as Error).message ?? fallback;
    if (message.toLowerCase().includes("schema cache")) {
      return `${fallback} Ensure the related Supabase table exists and migrations have been applied.`;
    }
    return message;
  };

  const salesDataErrors = [
    medicinesError ? formatDataError(medicinesErrorDetails, "We couldn't load the medicines catalogue.") : null,
    prescriptionsError ? formatDataError(prescriptionsErrorDetails, "Prescription records are unavailable right now.") : null,
    salesError ? formatDataError(salesErrorDetails, "Sales history failed to load.") : null,
  ].filter(Boolean) as string[];

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

      for (const item of items) {
        const { data: medicineRecord, error: fetchError } = await supabase
          .from("medicines")
          .select("quantity")
          .eq("id", item.medicineId)
          .single();

        if (fetchError) throw fetchError;

        const nextQuantity = Math.max(0, (medicineRecord?.quantity ?? 0) - item.quantity);
        const { error: updateError } = await supabase
          .from("medicines")
          .update({ quantity: nextQuantity })
          .eq("id", item.medicineId);

        if (updateError) throw updateError;
      }

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
      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 pb-16 pt-10 lg:px-12">
        <div className="space-y-2">
          <span className="text-xs uppercase tracking-[0.3em] text-primary/70">Point of Sale</span>
          <h1 className="text-4xl font-semibold leading-tight text-white">Sales & Dispensing Console</h1>
          <p className="max-w-2xl text-muted-foreground">
            Build prescriptions, capture patient payments, and keep stock levels synchronized in real time.
          </p>
        </div>

        {salesDataErrors.length > 0 && (
          <div className="space-y-3">
            {salesDataErrors.map((message, index) => (
              <Alert
                key={index}
                variant="destructive"
                className="border-destructive/40 bg-destructive/10 text-destructive-foreground"
              >
                <AlertTitle>Data source issue</AlertTitle>
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.6fr,1fr] fade-grid">
          <Card className="glass-panel border-primary/30">
            <CardHeader className="space-y-1">
              <CardTitle className="flex items-center gap-3 text-white">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary">
                  <ShoppingCart className="h-5 w-5" />
                </span>
                <div>
                  <span className="block text-sm uppercase tracking-[0.2em] text-white/60">Create New Sale</span>
                  <span className="text-lg font-semibold">Dispensing Workflow</span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid gap-5 md:grid-cols-12">
                    <FormField
                      control={form.control}
                      name="customerName"
                      render={({ field }) => (
                        <FormItem className="md:col-span-6">
                          <FormLabel>Customer Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Jane Doe" className="glass-panel border-primary/10" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="customerPhone"
                      render={({ field }) => (
                        <FormItem className="md:col-span-6">
                          <FormLabel>Customer Phone</FormLabel>
                          <FormControl>
                            <Input placeholder="0712 345 678" className="glass-panel border-primary/10" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="paymentMethod"
                      render={({ field }) => (
                        <FormItem className="md:col-span-6">
                          <FormLabel>Payment Method</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="glass-panel border-primary/10">
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
                        <FormItem className="md:col-span-6">
                          <FormLabel>Prescription</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value ?? ""}
                            disabled={loadingPrescriptions}
                          >
                            <FormControl>
                              <SelectTrigger className="glass-panel border-primary/10">
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
                    <div className="grid gap-4 md:grid-cols-12">
                      <div className="space-y-2 md:col-span-6">
                        <label className="text-sm font-medium text-white/80">Medicine</label>
                        <Select
                          value={selectedMedicineId}
                          onValueChange={setSelectedMedicineId}
                          disabled={loadingMedicines || medicines.length === 0}
                        >
                          <SelectTrigger className="glass-panel border-primary/10">
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
                        {medicinesError && (
                          <p className="text-xs text-destructive/80">
                            Unable to load medicines. {formatDataError(medicinesErrorDetails, "")}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2 md:col-span-3">
                        <label className="text-sm font-medium text-white/80">Quantity</label>
                        <Input
                          type="number"
                          min={1}
                          value={itemQuantity}
                          onChange={(event) => setItemQuantity(Number(event.target.value) || 1)}
                          className="glass-panel border-primary/10"
                        />
                      </div>
                      <div className="flex items-end md:col-span-3">
                        <Button
                          type="button"
                          onClick={handleAddItem}
                          disabled={!medicines.length || loadingMedicines}
                          className="w-full frosted-button"
                        >
                          <ShoppingCart className="mr-2 h-4 w-4" />
                          Add Item
                        </Button>
                      </div>
                    </div>

                    {selectedMedicine && (
                      <p className="text-sm text-muted-foreground">
                        Selling price: KES {selectedMedicine.selling_price.toLocaleString()} • Available: {selectedMedicine.quantity}
                      </p>
                    )}

                    <div className="glass-panel overflow-x-auto border border-primary/10">
                      <Table className="min-w-[720px]">
                        <TableHeader>
                          <TableRow className="bg-primary/5">
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
                                    className="text-destructive/80 hover:text-destructive"
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

                    <div className="flex flex-col gap-3 rounded-2xl border border-primary/10 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-lg font-semibold">
                        Total Due: <span className="text-primary">KES {totalAmount.toLocaleString()}</span>
                      </p>
                      <Button type="submit" disabled={saleMutation.isPending} className="frosted-button">
                        {saleMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving
                          </>
                        ) : (
                          "Complete Sale"
                        )}
                      </Button>
                    </div>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card className="glass-panel border-primary/30">
            <CardHeader className="space-y-1">
              <CardTitle className="flex items-center gap-3 text-white">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary">
                  <ReceiptText className="h-5 w-5" />
                </span>
                <div>
                  <span className="block text-sm uppercase tracking-[0.2em] text-white/60">Activity Feed</span>
                  <span className="text-lg font-semibold">Recent Sales</span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="glass-panel overflow-x-auto border border-primary/10">
                <Table className="min-w-[680px]">
                  <TableHeader>
                    <TableRow className="bg-primary/5">
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
                        <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                          <div className="flex items-center justify-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading sales...
                          </div>
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
                            <TableCell>
                              <Badge variant="secondary" className="bg-primary/20 text-primary uppercase tracking-wide">
                                {sale.payment_method}
                              </Badge>
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
