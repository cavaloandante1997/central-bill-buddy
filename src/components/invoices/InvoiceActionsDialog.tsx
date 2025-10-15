import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { getServiceLogo } from "@/lib/logos";

interface InvoiceActionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: any;
  onSuccess: () => void;
}

export function InvoiceActionsDialog({ open, onOpenChange, invoice, onSuccess }: InvoiceActionsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    issuer: "",
    contract_number: "",
    category: "",
    autopay_limit_cents: "",
  });

  const handleAIAutofill = async () => {
    setLoading(true);
    try {
      // Extract issuer from parsed fields or use a default
      const issuerFromParsed = invoice.parsed_fields?.issuer || "Unknown";
      
      console.log("Calling AI categorization for:", issuerFromParsed);
      const { data, error } = await supabase.functions.invoke("categorize-invoice", {
        body: {
          issuer: issuerFromParsed,
          parsedFields: invoice.parsed_fields,
        },
      });

      if (error) {
        console.error("Error calling categorize function:", error);
        throw error;
      }

      console.log("AI categorization result:", data);

      if (data.error) {
        if (data.error.includes("Rate limits exceeded")) {
          toast.error("Limite de pedidos atingido. Por favor, tente novamente mais tarde.");
        } else if (data.error.includes("Payment required")) {
          toast.error("Créditos insuficientes. Por favor, adicione créditos à sua conta.");
        } else {
          toast.error("Erro ao categorizar: " + data.error);
        }
        return;
      }

      setFormData({
        ...formData,
        issuer: issuerFromParsed,
        category: data.category || "",
      });

      toast.success("Categorização automática concluída!");
    } catch (error: any) {
      console.error("Error in AI autofill:", error);
      toast.error("Erro ao categorizar automaticamente");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Utilizador não autenticado");
        return;
      }

      // Create the service
      const { data: newService, error: serviceError } = await supabase
        .from("services")
        .insert({
          user_id: user.id,
          issuer: formData.issuer,
          contract_number: formData.contract_number || null,
          category: formData.category || null,
          autopay_limit_cents: formData.autopay_limit_cents
            ? parseInt(formData.autopay_limit_cents) * 100
            : null,
        })
        .select()
        .single();

      if (serviceError) throw serviceError;

      // Update the invoice to link it to the new service
      const { error: updateError } = await supabase
        .from("invoices")
        .update({ service_id: newService.id })
        .eq("id", invoice.id);

      if (updateError) throw updateError;

      toast.success("Serviço criado com sucesso!");
      onOpenChange(false);
      onSuccess();
      
      // Reset form
      setFormData({
        issuer: "",
        contract_number: "",
        category: "",
        autopay_limit_cents: "",
      });
    } catch (error: any) {
      console.error("Error creating service:", error);
      toast.error("Erro ao criar serviço");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleCreateService}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Criar Serviço a partir da Fatura
              <Sparkles className="h-5 w-5 text-primary" />
            </DialogTitle>
            <DialogDescription>
              Use IA para categorizar automaticamente ou preencha manualmente
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex justify-center">
              <Button
                type="button"
                onClick={handleAIAutofill}
                disabled={loading}
                variant="outline"
                className="gap-2"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Categorizar com IA
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="issuer">Fornecedor *</Label>
              <Input
                id="issuer"
                placeholder="EDP, MEO, Vodafone..."
                value={formData.issuer}
                onChange={(e) => setFormData({ ...formData, issuer: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Categoria</Label>
              <Input
                id="category"
                placeholder="Eletricidade, Internet, Água..."
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contract">Nº Contrato/Cliente</Label>
              <Input
                id="contract"
                placeholder="Opcional"
                value={formData.contract_number}
                onChange={(e) => setFormData({ ...formData, contract_number: e.target.value })}
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
                onChange={(e) => setFormData({ ...formData, autopay_limit_cents: e.target.value })}
              />
            </div>

            {formData.issuer && formData.category && (
              <div className="p-4 border rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground mb-2">Pré-visualização:</p>
                <div className="flex items-center gap-3">
                  <img 
                    src={getServiceLogo(formData.issuer, formData.category)} 
                    alt={formData.issuer}
                    className="w-10 h-10 rounded-lg border"
                  />
                  <div>
                    <p className="font-medium">{formData.issuer}</p>
                    <p className="text-sm text-muted-foreground">{formData.category}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !formData.issuer}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar Serviço"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
