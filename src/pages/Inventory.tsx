import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { AlertTriangle, Edit2, Loader2, MoreHorizontal, Package, Plus, Search, Trash2 } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";

type MedicineRecord = Tables<"medicines"> & {
  medicine_categories?: Pick<Tables<"medicine_categories">, "id" | "name"> | null;
  suppliers?: Pick<Tables<"suppliers">, "id" | "name"> | null;
};

type CategoryRecord = Tables<"medicine_categories">;
type SupplierRecord = Tables<"suppliers">;

const medicineFormSchema = z.object({
  name: z.string().min(2, "Name is required"),
  genericName: z.string().optional().or(z.literal("")),
  categoryId: z.string().optional().or(z.literal("")),
  newCategoryName: z.string().optional().or(z.literal("")),
  supplierId: z.string().optional().or(z.literal("")),
  batchNumber: z.string().min(1, "Batch number required"),
  unitPrice: z.coerce.number().min(0, "Unit price must be positive"),
  sellingPrice: z.coerce.number().min(0, "Selling price must be positive"),
  quantity: z.coerce.number().int().min(0, "Quantity cannot be negative"),
  reorderLevel: z.coerce.number().int().min(0, "Reorder level cannot be negative"),
  expiryDate: z.string().min(1, "Expiry date is required"),
  manufactureDate: z.string().optional().or(z.literal("")),
  requiresPrescription: z.boolean().default(false),
});

type MedicineFormValues = z.infer<typeof medicineFormSchema>;

const fetchMedicines = async (): Promise<MedicineRecord[]> => {
  const { data, error } = await supabase
    .from("medicines")
    .select("*, medicine_categories ( id, name ), suppliers ( id, name )")
    .order("name");

  if (error) throw error;
  return (data as MedicineRecord[]) ?? [];
};

const fetchCategories = async (): Promise<CategoryRecord[]> => {
  const { data, error } = await supabase
    .from("medicine_categories")
    .select("*")
    .order("name");

  if (error) throw error;
  return data ?? [];
};

const fetchSuppliers = async (): Promise<SupplierRecord[]> => {
  const { data, error } = await supabase
    .from("suppliers")
    .select("*")
    .order("name");

  if (error) throw error;
  return data ?? [];
};

interface MedicineFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData: MedicineRecord | null;
  categories: CategoryRecord[];
  suppliers: SupplierRecord[];
  onCompleted: () => void;
  isLoadingReferences: boolean;
}

const MedicineFormDialog = ({ open, onOpenChange, initialData, categories, suppliers, onCompleted, isLoadingReferences }: MedicineFormDialogProps) => {
  const queryClient = useQueryClient();

  const form = useForm<MedicineFormValues>({
    resolver: zodResolver(medicineFormSchema),
    defaultValues: {
      name: "",
      genericName: "",
      categoryId: "",
      newCategoryName: "",
      supplierId: "",
      batchNumber: "",
      unitPrice: 0,
      sellingPrice: 0,
      quantity: 0,
      reorderLevel: 0,
      expiryDate: "",
      manufactureDate: "",
      requiresPrescription: false,
    },
  });

  useEffect(() => {
    if (initialData) {
      form.reset({
        name: initialData.name,
        genericName: initialData.generic_name ?? "",
        categoryId: initialData.category_id ?? "",
        newCategoryName: "",
        supplierId: initialData.supplier_id ?? "",
        batchNumber: initialData.batch_number,
        unitPrice: Number(initialData.unit_price),
        sellingPrice: Number(initialData.selling_price),
        quantity: initialData.quantity,
        reorderLevel: initialData.reorder_level,
        expiryDate: initialData.expiry_date,
        manufactureDate: initialData.manufacture_date ?? "",
        requiresPrescription: Boolean(initialData.requires_prescription),
      });
    } else {
      form.reset({
        name: "",
        genericName: "",
        categoryId: "",
        newCategoryName: "",
        supplierId: "",
        batchNumber: "",
        unitPrice: 0,
        sellingPrice: 0,
        quantity: 0,
        reorderLevel: 0,
        expiryDate: "",
        manufactureDate: "",
        requiresPrescription: false,
      });
    }
  }, [initialData, form, open]);

  const upsertMutation = useMutation({
    mutationFn: async (values: MedicineFormValues) => {
      let categoryId = values.categoryId || null;

      if (!categoryId && values.newCategoryName?.trim()) {
        const { data: newCategory, error: categoryError } = await supabase
          .from("medicine_categories")
          .insert({
            name: values.newCategoryName.trim(),
          })
          .select("id")
          .single();

        if (categoryError) throw categoryError;
        categoryId = newCategory?.id ?? null;
      }

      const payload = {
        name: values.name.trim(),
        generic_name: values.genericName?.trim() || null,
        category_id: categoryId,
        supplier_id: values.supplierId || null,
        batch_number: values.batchNumber.trim(),
        unit_price: values.unitPrice,
        selling_price: values.sellingPrice,
        quantity: values.quantity,
        reorder_level: values.reorderLevel,
        expiry_date: values.expiryDate,
        manufacture_date: values.manufactureDate?.trim() || null,
        requires_prescription: values.requiresPrescription,
      } satisfies Partial<Tables<"medicines">>;

      if (initialData) {
        const { error } = await supabase.from("medicines").update(payload).eq("id", initialData.id);
        if (error) throw error;
        return initialData.id;
      }

      const { data, error } = await supabase
        .from("medicines")
        .insert({
          ...payload,
        })
        .select("id")
        .single();

      if (error) throw error;
      return data?.id;
    },
    onSuccess: () => {
      toast.success(initialData ? "Medicine updated" : "Medicine added");
      queryClient.invalidateQueries({ queryKey: ["inventory", "medicines"] });
      queryClient.invalidateQueries({ queryKey: ["sales", "medicines"] });
      onCompleted();
    },
    onError: (error) => {
      console.error("Failed to save medicine", error);
      toast.error(error instanceof Error ? error.message : "Failed to save medicine");
    },
  });

  const onSubmit = (values: MedicineFormValues) => {
    upsertMutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl border border-white/20 bg-gradient-to-br from-sidebar-background/90 via-background/90 to-background/80">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold text-white">
            {initialData ? "Edit medicine" : "Register new medicine"}
          </DialogTitle>
          <DialogDescription className="text-white/60">
            Keep your product catalogue accurate by updating stock, pricing, and compliance information.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid gap-5 md:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Medicine name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Amoxicillin" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="genericName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Generic name</FormLabel>
                    <FormControl>
                      <Input placeholder="Active ingredient" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select
                      value={field.value ?? ""}
                      onValueChange={field.onChange}
                      disabled={isLoadingReferences}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">Uncategorized</SelectItem>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="newCategoryName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>or create category</FormLabel>
                    <FormControl>
                      <Input placeholder="New category name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="supplierId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplier</FormLabel>
                    <Select
                      value={field.value ?? ""}
                      onValueChange={field.onChange}
                      disabled={isLoadingReferences}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select supplier" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">No supplier</SelectItem>
                        {suppliers.map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="batchNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Batch number</FormLabel>
                    <FormControl>
                      <Input placeholder="Batch reference" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              <FormField
                control={form.control}
                name="unitPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit price (KES)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sellingPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Selling price (KES)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Opening quantity</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="reorderLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reorder level</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="expiryDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expiry date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="manufactureDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Manufacture date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="requiresPrescription"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div>
                    <FormLabel>Requires prescription</FormLabel>
                    <p className="text-xs text-white/60">
                      Enable this to flag medicines that demand a valid prescription before dispensing.
                    </p>
                  </div>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="border-white/20 bg-transparent text-white hover:bg-white/10"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={upsertMutation.isPending} className="bg-primary text-primary-foreground">
                {upsertMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Saving
                  </span>
                ) : initialData ? (
                  "Update medicine"
                ) : (
                  "Create medicine"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

const Inventory = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<MedicineRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MedicineRecord | null>(null);

  const queryClient = useQueryClient();

  const {
    data: medicines = [],
    isLoading: loadingMedicines,
    isError: medicinesError,
    error: medicinesErrorDetails,
  } = useQuery({ queryKey: ["inventory", "medicines"], queryFn: fetchMedicines });

  const { data: categories = [], isLoading: loadingCategories } = useQuery({
    queryKey: ["inventory", "categories"],
    queryFn: fetchCategories,
  });

  const { data: suppliers = [], isLoading: loadingSuppliers } = useQuery({
    queryKey: ["suppliers", "list"],
    queryFn: fetchSuppliers,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("medicines").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Medicine removed");
      queryClient.invalidateQueries({ queryKey: ["inventory", "medicines"] });
      queryClient.invalidateQueries({ queryKey: ["sales", "medicines"] });
    },
    onError: (error) => {
      console.error("Failed to delete medicine", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete medicine");
    },
  });

  const filteredMedicines = useMemo(() => {
    if (!searchTerm) return medicines;
    return medicines.filter((medicine) => {
      const target = searchTerm.toLowerCase();
      return (
        medicine.name.toLowerCase().includes(target) ||
        (medicine.generic_name ?? "").toLowerCase().includes(target) ||
        medicine.batch_number.toLowerCase().includes(target) ||
        (medicine.medicine_categories?.name ?? "").toLowerCase().includes(target)
      );
    });
  }, [medicines, searchTerm]);

  const isExpiringSoon = (expiryDate: string) => {
    const today = new Date();
    const expiry = new Date(expiryDate);
    const ninetyDaysFromNow = new Date();
    ninetyDaysFromNow.setDate(today.getDate() + 90);
    return expiry <= ninetyDaysFromNow && expiry >= today;
  };

  const isExpired = (expiryDate: string) => new Date(expiryDate) < new Date();

  const getInventoryErrorMessage = (error: unknown) => {
    if (!error) {
      return "We couldn't reach the inventory service. Please try again.";
    }
    const message = (error as Error).message ?? "";
    if (message.toLowerCase().includes("schema cache")) {
      return "Supabase is missing the required medicines tables. Run the latest migrations in supabase/migrations, apply them to your project, then redeploy.";
    }
    return message;
  };

  const inventoryErrorMessage = medicinesError ? getInventoryErrorMessage(medicinesErrorDetails) : null;

  return (
    <DashboardLayout>
      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 pb-16 pt-10 lg:px-12">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.4em] text-white/50">Inventory</p>
            <h1 className="text-3xl font-bold text-white lg:text-4xl">Medicines & Stock Control</h1>
            <p className="max-w-2xl text-sm text-white/70">
              Maintain precise records of every medicine batch, monitor expiries, and enforce prescription protocols in real time.
            </p>
          </div>
          <Button
            onClick={() => {
              setEditingMedicine(null);
              setDialogOpen(true);
            }}
            className="flex items-center gap-2 rounded-full bg-accent px-6 py-5 text-accent-foreground shadow-[0_25px_55px_-25px_rgba(168,85,247,0.7)] transition hover:-translate-y-1"
          >
            <Plus className="h-5 w-5" />
            Register medicine
          </Button>
        </div>

        <div className="glass-panel flex flex-col gap-6 border border-white/10 p-6">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40" />
              <Input
                placeholder="Search by name, batch, category..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="h-14 rounded-2xl border-white/10 bg-white/10 pl-12 text-base text-white placeholder:text-white/40"
              />
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-white/50 md:justify-end">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-2 w-2 rounded-full bg-destructive" /> Low stock
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-2 w-2 rounded-full bg-warning" /> Expiring soon
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-2 w-2 rounded-full bg-primary" /> Prescription
              </div>
            </div>
          </div>

          {inventoryErrorMessage && (
            <Alert variant="destructive" className="border-destructive/40 bg-destructive/10 text-destructive-foreground">
              <AlertTitle>Inventory data unavailable</AlertTitle>
              <AlertDescription>{inventoryErrorMessage}</AlertDescription>
            </Alert>
          )}

          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <Table className="min-w-[960px]">
              <TableHeader className="bg-white/5">
                <TableRow className="border-white/10">
                  <TableHead className="text-white/70">Medicine</TableHead>
                  <TableHead className="text-white/70">Category</TableHead>
                  <TableHead className="text-white/70">Batch</TableHead>
                  <TableHead className="text-right text-white/70">Quantity</TableHead>
                  <TableHead className="text-right text-white/70">Selling (KES)</TableHead>
                  <TableHead className="text-white/70">Expiry</TableHead>
                  <TableHead className="text-white/70">Status</TableHead>
                  <TableHead className="text-right text-white/70">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingMedicines ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center text-white/60">
                      <div className="flex items-center justify-center gap-3">
                        <Loader2 className="h-5 w-5 animate-spin" /> Loading inventory...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : medicinesError ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-destructive">
                      {inventoryErrorMessage ?? "Unable to load medicines"}
                    </TableCell>
                  </TableRow>
                ) : filteredMedicines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-white/60">
                      No medicines match your search filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMedicines.map((medicine) => (
                    <TableRow key={medicine.id} className="border-white/5 bg-white/5/10 backdrop-blur-sm transition hover:bg-white/10">
                      <TableCell className="space-y-1 font-semibold text-white">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-white/50" />
                          {medicine.name}
                        </div>
                        {medicine.generic_name && (
                          <span className="text-xs uppercase tracking-widest text-white/40">
                            {medicine.generic_name}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-white/70">
                        {medicine.medicine_categories?.name ?? "—"}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-white/70">
                        {medicine.batch_number}
                      </TableCell>
                      <TableCell className="text-right text-white">
                        <span
                          className={`font-semibold ${
                            medicine.quantity <= medicine.reorder_level ? "text-destructive" : ""
                          }`}
                        >
                          {medicine.quantity}
                        </span>
                        <span className="block text-xs text-white/50">Reorder @ {medicine.reorder_level}</span>
                      </TableCell>
                      <TableCell className="text-right text-white/80">
                        {Number(medicine.selling_price).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-white/70">
                        {new Date(medicine.expiry_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          {medicine.quantity <= medicine.reorder_level && (
                            <Badge variant="destructive" className="rounded-full px-3 py-1 text-xs">
                              Low stock
                            </Badge>
                          )}
                          {isExpired(medicine.expiry_date) ? (
                            <Badge variant="destructive" className="rounded-full px-3 py-1 text-xs">
                              Expired
                            </Badge>
                          ) : (
                            isExpiringSoon(medicine.expiry_date) && (
                              <Badge variant="outline" className="flex items-center gap-1 rounded-full border-warning/60 px-3 py-1 text-xs text-warning">
                                <AlertTriangle className="h-3 w-3" /> Soon
                              </Badge>
                            )
                          )}
                          {medicine.requires_prescription && (
                            <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
                              Rx only
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="rounded-full text-white hover:bg-white/20">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44 border-white/10 bg-background/95 text-white">
                            <DropdownMenuItem
                              onClick={() => {
                                setEditingMedicine(medicine);
                                setDialogOpen(true);
                              }}
                              className="gap-2 text-white/80 focus:bg-white/10"
                            >
                              <Edit2 className="h-4 w-4" /> Edit details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setDeleteTarget(medicine)}
                              className="gap-2 text-destructive focus:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" /> Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <MedicineFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialData={editingMedicine}
        categories={categories}
        suppliers={suppliers}
        isLoadingReferences={loadingCategories || loadingSuppliers}
        onCompleted={() => {
          setDialogOpen(false);
          setEditingMedicine(null);
        }}
      />

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="border border-white/10 bg-background/95 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove medicine</AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              This will permanently delete {deleteTarget?.name}. Stock history will remain in Supabase logs.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/20 bg-transparent text-white hover:bg-white/10">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/80"
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default Inventory;
