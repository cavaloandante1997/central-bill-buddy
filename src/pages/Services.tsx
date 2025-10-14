import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Zap, ZapOff } from "lucide-react";
import { toast } from "sonner";
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

      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setServices(data || []);
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
            <h2 className="text-3xl font-bold tracking-tight">Serviços</h2>
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
          <p className="text-muted-foreground">A carregar...</p>
        ) : services.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <p className="text-muted-foreground mb-4">
                Ainda não tem serviços registados
              </p>
              <Button onClick={() => setDialogOpen(true)}>
                Adicionar Primeiro Serviço
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => (
              <Card key={service.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{service.issuer}</CardTitle>
                      <CardDescription className="mt-1">
                        {service.category || "Sem categoria"}
                      </CardDescription>
                    </div>
                    <Badge
                      variant={service.status === "active" ? "default" : "secondary"}
                    >
                      {service.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {service.contract_number && (
                    <div>
                      <p className="text-sm text-muted-foreground">Nº Contrato</p>
                      <p className="text-sm font-medium">{service.contract_number}</p>
                    </div>
                  )}
                  {service.autopay_limit_cents && (
                    <div>
                      <p className="text-sm text-muted-foreground">Limite Autopay</p>
                      <p className="text-sm font-medium">
                        {formatCurrency(service.autopay_limit_cents)}
                      </p>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex items-center gap-2">
                      {service.autopay ? (
                        <Zap className="h-4 w-4 text-success" />
                      ) : (
                        <ZapOff className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="text-sm font-medium">Autopay</span>
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
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
