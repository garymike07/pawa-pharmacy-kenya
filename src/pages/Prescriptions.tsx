import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { FileText, Loader2 } from "lucide-react";

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
      <div className="space-y-8">
        <div className="space-y-2">
          <span className="text-xs uppercase tracking-[0.3em] text-primary/70">Clinical Records</span>
          <h1 className="text-4xl font-semibold leading-tight text-white">Prescription Management</h1>
          <p className="max-w-2xl text-muted-foreground">
            Capture doctor directives, patient notes, and keep your pharmacy records compliant with regulatory requirements.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.4fr,1fr] fade-grid">
          <Card className="glass-panel border-primary/30">
            <CardHeader className="space-y-1">
              <CardTitle className="flex items-center gap-3 text-white">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary">
                  <FileText className="h-5 w-5" />
                </span>
                <div>
                  <span className="block text-sm uppercase tracking-[0.2em] text-white/60">Capture Prescription</span>
                  <span className="text-lg font-semibold">New Entry</span>
                </div>
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
                            <Input placeholder="RX-20241005-123" className="glass-panel border-primary/10" {...field} />
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
                            <Input type="date" className="glass-panel border-primary/10" {...field} />
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
                            <Input placeholder="John Doe" className="glass-panel border-primary/10" {...field} />
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
                            <Input placeholder="0712 345 678" className="glass-panel border-primary/10" {...field} />
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
                            <Input placeholder="Dr. Jane Smith" className="glass-panel border-primary/10" {...field} />
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
                            <Input placeholder="License number" className="glass-panel border-primary/10" {...field} />
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
                            className="glass-panel border-primary/10"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" disabled={createPrescriptionMutation.isPending} className="frosted-button">
                    {createPrescriptionMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving
                      </>
                    ) : (
                      "Save Prescription"
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card className="glass-panel border-primary/30">
            <CardHeader className="space-y-1">
              <CardTitle className="flex items-center gap-3 text-white">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary">
                  <FileText className="h-5 w-5" />
                </span>
                <div>
                  <span className="block text-sm uppercase tracking-[0.2em] text-white/60">Records</span>
                  <span className="text-lg font-semibold">Recent Prescriptions</span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="glass-panel border border-primary/10 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-primary/5">
                      <TableHead>Number</TableHead>
                      <TableHead>Patient</TableHead>
                      <TableHead>Doctor</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                          <div className="flex items-center justify-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading prescriptions...
                          </div>
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
                                <Badge className="mt-1 w-fit bg-primary/15 text-primary/90">
                                  {prescription.patient_phone}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span>{prescription.doctor_name}</span>
                              {prescription.doctor_license && (
                                <Badge className="mt-1 w-fit bg-primary/15 text-primary/90">
                                  {prescription.doctor_license}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span>{new Date(prescription.prescription_date).toLocaleDateString()}</span>
                              {prescription.notes && (
                                <span className="mt-1 text-xs text-muted-foreground">
                                  {prescription.notes}
                                </span>
                              )}
                            </div>
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
