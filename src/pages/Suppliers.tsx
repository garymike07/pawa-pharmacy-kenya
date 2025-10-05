import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Truck } from "lucide-react";

const supplierFormSchema = z.object({
  name: z.string().min(2, "Supplier name is required"),
  contactPerson: z.string().optional().or(z.literal("")),
  phone: z
    .string()
    .regex(/^\+?[0-9\s-]*$/, "Invalid phone number")
    .optional()
    .or(z.literal("")),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
});

type SupplierFormValues = z.infer<typeof supplierFormSchema>;

type SupplierRecord = {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  created_at: string | null;
};

const fetchSuppliers = async (): Promise<SupplierRecord[]> => {
  const { data, error } = await supabase
    .from("suppliers")
    .select("id, name, contact_person, phone, email, address, created_at")
    .order("name");

  if (error) throw error;
  return data || [];
};

const Suppliers = () => {
  const queryClient = useQueryClient();

  const {
    data: suppliers = [],
    isLoading,
  } = useQuery({ queryKey: ["suppliers"], queryFn: fetchSuppliers });

  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierFormSchema),
    defaultValues: {
      name: "",
      contactPerson: "",
      phone: "",
      email: "",
      address: "",
    },
  });

  const createSupplierMutation = useMutation({
    mutationFn: async (values: SupplierFormValues) => {
      const { error } = await supabase.from("suppliers").insert({
        name: values.name.trim(),
        contact_person: values.contactPerson?.trim() || null,
        phone: values.phone?.trim() || null,
        email: values.email?.trim() || null,
        address: values.address?.trim() || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Supplier added");
      form.reset({ name: "", contactPerson: "", phone: "", email: "", address: "" });
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    },
    onError: (error) => {
      console.error("Failed to add supplier", error);
      toast.error(error instanceof Error ? error.message : "Failed to add supplier");
    },
  });

  const onSubmit = (values: SupplierFormValues) => {
    createSupplierMutation.mutate(values);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Suppliers</h1>
          <p className="text-muted-foreground mt-1">Manage supplier information</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.3fr,1fr]">
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Add Supplier
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Supplier Name</FormLabel>
                          <FormControl>
                            <Input placeholder="PharmaCo Ltd" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="contactPerson"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Person</FormLabel>
                          <FormControl>
                            <Input placeholder="Jane Doe" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input placeholder="0712 345 678" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="supplier@email.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address / Notes</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Physical address or additional notes" rows={4} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" disabled={createSupplierMutation.isPending}>
                    {createSupplierMutation.isPending ? "Saving..." : "Save Supplier"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Suppliers Directory</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Name</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Email</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-6">
                          Loading suppliers...
                        </TableCell>
                      </TableRow>
                    ) : suppliers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                          No suppliers added yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      suppliers.map((supplier) => (
                        <TableRow key={supplier.id}>
                          <TableCell className="font-medium">
                            <div className="flex flex-col">
                              <span>{supplier.name}</span>
                              {supplier.address && (
                                <span className="text-xs text-muted-foreground mt-1">
                                  {supplier.address}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{supplier.contact_person || "-"}</TableCell>
                          <TableCell>{supplier.phone || "-"}</TableCell>
                          <TableCell>{supplier.email || "-"}</TableCell>
                        </TableRow>
                      ))
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

export default Suppliers;
