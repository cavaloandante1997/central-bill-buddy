import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { InvoiceActionsDialog } from "@/components/invoices/InvoiceActionsDialog";
import { InvoiceUploadDialog } from "@/components/invoices/InvoiceUploadDialog";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, FileText, AlertCircle } from "lucide-react";
import { getServiceLogo, getCategoryColor } from "@/lib/logos";

export default function Invoices() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: servicesData } = await supabase
        .from("services")
        .select("id")
        .eq("user_id", user.id);

      if (!servicesData || servicesData.length === 0) {
        setLoading(false);
        return;
      }

      const serviceIds = servicesData.map(s => s.id);

      const { data, error } = await supabase
        .from("invoices")
        .select(`
          *,
          service:services(issuer, category)
        `)
        .in("service_id", serviceIds)
        .order("due_date", { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (error) {
      console.error("Error loading invoices:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-PT");
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("pt-PT", {
      style: "currency",
      currency: "EUR",
    }).format(cents / 100);
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "paid":
        return "default";
      case "pending":
        return "secondary";
      case "overdue":
        return "destructive";
      case "failed":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "paid":
        return "Paga";
      case "pending":
        return "Pendente";
      case "overdue":
        return "Atrasada";
      case "failed":
        return "Falhada";
      case "expired":
        return "Expirada";
      default:
        return status;
    }
  };

  const handleCreateService = (invoice: any) => {
    setSelectedInvoice(invoice);
    setDialogOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Faturas
            </h2>
            <p className="text-muted-foreground">
              Histórico completo de todas as suas faturas
            </p>
          </div>
          <Button onClick={() => setUploadDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Carregar Fatura
          </Button>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-48 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : invoices.length === 0 ? (
          <Card className="border-2 border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <FileText className="h-8 w-8 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-lg font-medium mb-1">Ainda não tem faturas registadas</p>
                <p className="text-sm text-muted-foreground">
                  As faturas aparecerão aqui quando forem recebidas
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-2">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Data Emissão</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => {
                    const hasService = !!invoice.service?.issuer;
                    const serviceData = invoice.service as any;
                    const logo = hasService 
                      ? getServiceLogo(serviceData.issuer, serviceData.category, serviceData.logo_url)
                      : null;
                    const categoryColor = hasService 
                      ? getCategoryColor(serviceData.category)
                      : "";

                    return (
                      <TableRow key={invoice.id} className="group">
                        <TableCell>
                          {logo ? (
                            <div className="w-10 h-10 rounded-lg border-2 border-border overflow-hidden shadow-sm flex items-center justify-center bg-white">
                              <img 
                                src={logo} 
                                alt={invoice.service?.issuer || ""}
                                className="w-full h-full object-contain p-1"
                              />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                              <AlertCircle className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          {hasService ? (
                            invoice.service.issuer
                          ) : (
                            <span className="text-muted-foreground italic">Sem fornecedor</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {hasService ? (
                            <span className={`font-medium ${categoryColor}`}>
                              {invoice.service.category}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          {invoice.issue_date ? formatDate(invoice.issue_date) : "—"}
                        </TableCell>
                        <TableCell>{formatDate(invoice.due_date)}</TableCell>
                        <TableCell className="font-bold">
                          {formatCurrency(invoice.amount_cents)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusVariant(invoice.status)}>
                            {getStatusLabel(invoice.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {!hasService && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => handleCreateService(invoice)}
                            >
                              <Plus className="h-3 w-3" />
                              Criar Serviço
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      <InvoiceActionsDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        invoice={selectedInvoice}
        onSuccess={loadInvoices}
      />

      <InvoiceUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onSuccess={loadInvoices}
      />
    </DashboardLayout>
  );
}
