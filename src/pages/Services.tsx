import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Zap, ZapOff, Trash2, Building2 } from "lucide-react";
import { toast } from "sonner";
import { getServiceLogo, getCategoryColor } from "@/lib/logos";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Services() {
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    issuer: "",
    contract_number: "",
    category: "",
    autopay_limit_cents: "",
  });

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: servicesData, error } = await supabase
        .from("services")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch last invoice for each service
      const servicesWithInvoices = await Promise.all(
        (servicesData || []).map(async (service) => {
          const { data: invoices } = await supabase
            .from("invoices")
            .select("*")
            .eq("service_id", service.id)
            .order("issue_date", { ascending: false })
            .limit(1);

          return {
            ...service,
            lastInvoice: invoices?.[0] || null,
          };
        })
      );

      setServices(servicesWithInvoices);
    } catch (error) {
      console.error("Error loading services:", error);
      toast.error("Erro ao carregar serviços");
    } finally {
      setLoading(false);
    }
  };

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from("services").insert({
        user_id: user.id,
        issuer: formData.issuer,
        contract_number: formData.contract_number || null,
        category: formData.category || null,
        autopay_limit_cents: formData.autopay_limit_cents
          ? parseInt(formData.autopay_limit_cents) * 100
          : null,
      });

      if (error) throw error;

      toast.success("Serviço adicionado com sucesso");
      setDialogOpen(false);
      setFormData({
        issuer: "",
        contract_number: "",
        category: "",
        autopay_limit_cents: "",
      });
      loadServices();
    } catch (error) {
      console.error("Error adding service:", error);
      toast.error("Erro ao adicionar serviço");
    }
  };

  const toggleAutopay = async (serviceId: string, currentState: boolean) => {
    try {
      const { error } = await supabase
        .from("services")
        .update({ autopay: !currentState })
        .eq("id", serviceId);

      if (error) throw error;

      toast.success(
        !currentState
          ? "Autopay ativado"
          : "Autopay desativado"
      );
      loadServices();
    } catch (error) {
      console.error("Error toggling autopay:", error);
      toast.error("Erro ao atualizar autopay");
    }
  };

  const formatCurrency = (cents: number | null) => {
    if (!cents) return "—";
    return new Intl.NumberFormat("pt-PT", {
      style: "currency",
      currency: "EUR",
    }).format(cents / 100);
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Serviços
            </h2>
            <p className="text-muted-foreground">
              Gerir fornecedores e configurações de autopay
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Adicionar Serviço
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleAddService}>
                <DialogHeader>
                  <DialogTitle>Novo Serviço</DialogTitle>
                  <DialogDescription>
                    Adicione um novo fornecedor de serviços para rastrear faturas
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="issuer">Fornecedor *</Label>
                    <Input
                      id="issuer"
                      placeholder="EDP, MEO, Vodafone..."
                      value={formData.issuer}
                      onChange={(e) =>
                        setFormData({ ...formData, issuer: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contract">Nº Contrato/Cliente</Label>
                    <Input
                      id="contract"
                      placeholder="Opcional"
                      value={formData.contract_number}
                      onChange={(e) =>
                        setFormData({ ...formData, contract_number: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Categoria</Label>
                    <Input
                      id="category"
                      placeholder="Eletricidade, Internet, Água..."
                      value={formData.category}
                      onChange={(e) =>
                        setFormData({ ...formData, category: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="limit">Limite Autopay (€)</Label>
                    <Input
                      id="limit"
                      type="number"
                      step="0.01"
                      placeholder="150.00"
                      value={formData.autopay_limit_cents}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          autopay_limit_cents: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">Adicionar</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-64 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : services.length === 0 ? (
          <Card className="border-2 border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Plus className="h-8 w-8 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-lg font-medium mb-1">Ainda não tem serviços registados</p>
                <p className="text-sm text-muted-foreground">
                  Adicione o seu primeiro fornecedor para começar a rastrear faturas
                </p>
              </div>
              <Button onClick={() => setDialogOpen(true)} size="lg" className="gap-2">
                <Plus className="h-4 w-4" />
                Adicionar Primeiro Serviço
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => {
              const logo = getServiceLogo(service.issuer, service.category, service.logo_url);
              const categoryColor = getCategoryColor(service.category);
              
              return (
                <Card 
                  key={service.id} 
                  className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-2 hover:border-primary/50 overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  <CardHeader className="relative">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-xl bg-card border-2 border-border flex items-center justify-center overflow-hidden shadow-sm">
                          {logo ? (
                            <img src={logo} alt={service.issuer} className="w-full h-full object-contain p-2" />
                          ) : (
                            <Building2 className="h-8 w-8 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <CardTitle className="text-lg">{service.issuer}</CardTitle>
                          {service.category && (
                            <CardDescription className={`mt-0.5 font-medium ${categoryColor}`}>
                              {service.category}
                            </CardDescription>
                          )}
                        </div>
                      </div>
                      <Badge
                        variant={service.status === "active" ? "default" : "secondary"}
                        className="shrink-0"
                      >
                        {service.status}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="relative space-y-4">
                    {service.lastInvoice && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Última Fatura</span>
                          <Badge variant={service.lastInvoice.status === "paid" ? "default" : "secondary"}>
                            {service.lastInvoice.status === "paid" ? "Paga" : "Em Aberto"}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <p className="text-muted-foreground">Emissão</p>
                            <p className="font-medium">
                              {service.lastInvoice.issue_date 
                                ? new Date(service.lastInvoice.issue_date).toLocaleDateString("pt-PT")
                                : "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Vencimento</p>
                            <p className="font-medium">
                              {new Date(service.lastInvoice.due_date).toLocaleDateString("pt-PT")}
                            </p>
                          </div>
                        </div>

                        {service.lastInvoice.parsed_fields?.multibanco_entity && (
                          <div className="bg-muted/50 rounded-lg p-2 space-y-1">
                            <p className="text-xs text-muted-foreground">Multibanco</p>
                            <div className="flex items-center justify-between">
                              <span className="text-xs">Entidade:</span>
                              <span className="text-xs font-mono font-bold">
                                {service.lastInvoice.parsed_fields.multibanco_entity}
                              </span>
                            </div>
                            {service.lastInvoice.parsed_fields?.multibanco_reference && (
                              <div className="flex items-center justify-between">
                                <span className="text-xs">Referência:</span>
                                <span className="text-xs font-mono font-bold">
                                  {service.lastInvoice.parsed_fields.multibanco_reference}
                                </span>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="pt-2 border-t border-border">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Valor</span>
                            <span className="text-sm font-bold">
                              {formatCurrency(service.lastInvoice.amount_cents)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {service.contract_number && (
                      <div className="bg-muted/50 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground mb-1">Nº Contrato</p>
                        <p className="text-sm font-mono font-medium">{service.contract_number}</p>
                      </div>
                    )}
                    
                    {service.autopay_limit_cents && (
                      <div className="bg-muted/50 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground mb-1">Limite Autopay</p>
                        <p className="text-sm font-bold">
                          {formatCurrency(service.autopay_limit_cents)}
                        </p>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-3 border-t border-border">
                      <div className="flex items-center gap-2">
                        {service.autopay ? (
                          <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center">
                            <Zap className="h-4 w-4 text-success" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                            <ZapOff className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium">Autopay</p>
                          <p className="text-xs text-muted-foreground">
                            {service.autopay ? "Ativado" : "Desativado"}
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={service.autopay}
                        onCheckedChange={() =>
                          toggleAutopay(service.id, service.autopay)
                        }
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
