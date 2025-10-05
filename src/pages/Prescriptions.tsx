import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileText } from "lucide-react";

const prescriptionFormSchema = z.object({
  prescriptionNumber: z.string().min(4, "Prescription number is required"),
  prescriptionDate: z.string().min(1, "Select a date"),
  patientName: z.string().min(2, "Patient name is required"),
  patientPhone: z
    .string()
    .regex(/^\+?[0-9\s-]*$/, "Invalid phone number")
    .optional()
    .or(z.literal("")),
  doctorName: z.string().min(2, "Doctor name is required"),
  doctorLicense: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

type PrescriptionFormValues = z.infer<typeof prescriptionFormSchema>;

type PrescriptionRecord = {
  id: string;
  prescription_number: string;
  patient_name: string;
  patient_phone: string | null;
  doctor_name: string;
  doctor_license: string | null;
  prescription_date: string;
  notes: string | null;
  created_at: string | null;
};

const fetchPrescriptions = async (): Promise<PrescriptionRecord[]> => {
  const { data, error } = await supabase
    .from("prescriptions")
    .select(
      "id, prescription_number, patient_name, patient_phone, doctor_name, doctor_license, prescription_date, notes, created_at",
    )
    .order("prescription_date", { ascending: false });

  if (error) throw error;
  return data || [];
};

const generatePrescriptionNumber = () =>
  `RX-${new Date().toISOString().split("T")[0].replace(/-/g, "")}-${Math.floor(Math.random() * 900 + 100)}`;

const Prescriptions = () => {
  const queryClient = useQueryClient();

  const {
    data: prescriptions = [],
    isLoading,
  } = useQuery({ queryKey: ["prescriptions"], queryFn: fetchPrescriptions });

  const form = useForm<PrescriptionFormValues>({
    resolver: zodResolver(prescriptionFormSchema),
    defaultValues: {
      prescriptionNumber: "",
      prescriptionDate: new Date().toISOString().split("T")[0],
      patientName: "",
      patientPhone: "",
      doctorName: "",
      doctorLicense: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (!form.getValues("prescriptionNumber")) {
      form.setValue("prescriptionNumber", generatePrescriptionNumber());
    }
  }, [form]);

  const createPrescriptionMutation = useMutation({
    mutationFn: async (values: PrescriptionFormValues) => {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      const { error } = await supabase.from("prescriptions").insert({
        prescription_number: values.prescriptionNumber.trim(),
        prescription_date: values.prescriptionDate,
        patient_name: values.patientName.trim(),
        patient_phone: values.patientPhone?.trim() || null,
        doctor_name: values.doctorName.trim(),
        doctor_license: values.doctorLicense?.trim() || null,
        notes: values.notes?.trim() || null,
        created_by: userData.user?.id ?? null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Prescription saved");
      form.reset({
        prescriptionNumber: generatePrescriptionNumber(),
        prescriptionDate: new Date().toISOString().split("T")[0],
        patientName: "",
        patientPhone: "",
        doctorName: "",
        doctorLicense: "",
        notes: "",
      });
      queryClient.invalidateQueries({ queryKey: ["prescriptions"] });
    },
    onError: (error) => {
      console.error("Failed to save prescription", error);
      toast.error(error instanceof Error ? error.message : "Failed to save prescription");
    },
  });

  const onSubmit = (values: PrescriptionFormValues) => {
    createPrescriptionMutation.mutate(values);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Prescriptions</h1>
          <p className="text-muted-foreground mt-1">Manage patient prescriptions</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.4fr,1fr]">
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                New Prescription
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="prescriptionNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Prescription Number</FormLabel>
                          <FormControl>
                            <Input placeholder="RX-20241005-123" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="prescriptionDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="patientName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Patient Name</FormLabel>
                          <FormControl>
                            <Input placeholder="John Doe" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="patientPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Patient Phone</FormLabel>
                          <FormControl>
                            <Input placeholder="0712 345 678" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="doctorName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Doctor Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Dr. Jane Smith" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="doctorLicense"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Doctor License</FormLabel>
                          <FormControl>
                            <Input placeholder="License number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Prescription details, dosage instructions, etc."
                            rows={4}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" disabled={createPrescriptionMutation.isPending}>
                    {createPrescriptionMutation.isPending ? "Saving..." : "Save Prescription"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Prescriptions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Number</TableHead>
                      <TableHead>Patient</TableHead>
                      <TableHead>Doctor</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-6">
                          Loading prescriptions...
                        </TableCell>
                      </TableRow>
                    ) : prescriptions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                          No prescriptions recorded yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      prescriptions.map((prescription) => (
                        <TableRow key={prescription.id}>
                          <TableCell className="font-medium">
                            {prescription.prescription_number}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span>{prescription.patient_name}</span>
                              {prescription.patient_phone && (
                                <span className="text-xs text-muted-foreground">
                                  {prescription.patient_phone}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span>{prescription.doctor_name}</span>
                              {prescription.doctor_license && (
                                <span className="text-xs text-muted-foreground">
                                  {prescription.doctor_license}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {new Date(prescription.prescription_date).toLocaleDateString()}
                          </TableCell>
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

export default Prescriptions;
