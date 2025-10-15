import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getServiceLogo, getCategoryColor } from "@/lib/logos";
import { Zap, Calendar } from "lucide-react";

interface ServiceCardProps {
  service: {
    id: string;
    issuer: string;
    category?: string | null;
    contract_number?: string | null;
    autopay?: boolean;
  };
  nextInvoice?: {
    due_date: string;
    amount_cents: number;
    status: string;
  } | null;
  onClick?: () => void;
}

export function ServiceCard({ service, nextInvoice, onClick }: ServiceCardProps) {
  const logo = getServiceLogo(service.issuer, service.category);
  const categoryColor = getCategoryColor(service.category);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("pt-PT", {
      style: "currency",
      currency: "EUR",
    }).format(amount / 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-PT", {
      day: "2-digit",
      month: "short",
    });
  };

  const isOverdue = nextInvoice && new Date(nextInvoice.due_date) < new Date();

  return (
    <Card 
      className="group hover:shadow-lg transition-all duration-300 cursor-pointer hover:-translate-y-1 border-2 hover:border-primary/50 overflow-hidden"
      onClick={onClick}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <CardHeader className="relative pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-card border-2 border-border flex items-center justify-center overflow-hidden shadow-sm">
              <img src={logo} alt={service.issuer} className="w-full h-full object-cover" />
            </div>
            <div>
              <h3 className="font-semibold text-base leading-tight">{service.issuer}</h3>
              {service.category && (
                <p className={`text-xs font-medium mt-0.5 ${categoryColor}`}>
                  {service.category}
                </p>
              )}
            </div>
          </div>
          {service.autopay && (
            <div className="flex items-center gap-1 bg-success/10 text-success px-2 py-1 rounded-full">
              <Zap className="h-3 w-3" />
              <span className="text-xs font-medium">Auto</span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="relative space-y-3">
        {nextInvoice ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Próxima fatura</span>
              <span className="text-lg font-bold">{formatCurrency(nextInvoice.amount_cents)}</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                <span className="text-xs">Vencimento</span>
              </div>
              <Badge variant={isOverdue ? "destructive" : "secondary"} className="text-xs">
                {formatDate(nextInvoice.due_date)}
              </Badge>
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">Sem faturas pendentes</p>
          </div>
        )}

        {service.contract_number && (
          <div className="pt-2 border-t border-border/50">
            <p className="text-xs text-muted-foreground">
              Contrato: <span className="text-foreground font-mono">{service.contract_number}</span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
