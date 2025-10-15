import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { ServiceCard } from "@/components/dashboard/ServiceCard";
import { supabase } from "@/integrations/supabase/client";
import { Euro, Calendar, AlertCircle, CheckCircle2, TrendingUp, ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";

interface DashboardStats {
  totalDueAmount: number;
  nextDueDate: string | null;
  overdueCount: number;
  paidThisMonth: number;
  totalPaidThisMonth: number;
  averageMonthlySpend: number;
}

interface ServiceWithInvoice {
  service: any;
  nextInvoice: any | null;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalDueAmount: 0,
    nextDueDate: null,
    overdueCount: 0,
    paidThisMonth: 0,
    totalPaidThisMonth: 0,
    averageMonthlySpend: 0,
  });
  const [servicesWithInvoices, setServicesWithInvoices] = useState<ServiceWithInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load services
      const { data: servicesData } = await supabase
        .from("services")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active");

      // Load invoices for stats
      const { data: invoicesData } = await supabase
        .from("invoices")
        .select(`
          *,
          service:services(issuer, category)
        `)
        .in("service_id", (servicesData || []).map(s => s.id));

      if (invoicesData && servicesData) {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        // Calculate stats
        const pending = invoicesData.filter(i => i.status === "pending");
        const overdue = invoicesData.filter(i => 
          i.status === "pending" && new Date(i.due_date) < now
        );
        const paidThisMonth = invoicesData.filter(i => 
          i.status === "paid" && 
          new Date(i.updated_at).getMonth() === currentMonth &&
          new Date(i.updated_at).getFullYear() === currentYear
        );

        const totalDue = pending.reduce((sum, inv) => sum + inv.amount_cents, 0);
        const totalPaidAmount = paidThisMonth.reduce((sum, inv) => sum + inv.amount_cents, 0);
        
        const nextDue = pending.length > 0
          ? pending.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0].due_date
          : null;

        // Calculate average monthly spend (last 3 months)
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        const recentPaid = invoicesData.filter(i => 
          i.status === "paid" && new Date(i.updated_at) >= threeMonthsAgo
        );
        const avgMonthly = recentPaid.length > 0 
          ? recentPaid.reduce((sum, inv) => sum + inv.amount_cents, 0) / 3
          : 0;

        setStats({
          totalDueAmount: totalDue / 100,
          nextDueDate: nextDue,
          overdueCount: overdue.length,
          paidThisMonth: paidThisMonth.length,
          totalPaidThisMonth: totalPaidAmount / 100,
          averageMonthlySpend: avgMonthly / 100,
        });

        // Combine services with their next pending invoice
        const servicesWithNextInvoice: ServiceWithInvoice[] = servicesData.map(service => {
          const servicePendingInvoices = pending
            .filter(inv => inv.service_id === service.id)
            .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
          
          return {
            service,
            nextInvoice: servicePendingInvoices[0] || null,
          };
        });

        setServicesWithInvoices(servicesWithNextInvoice);
      }
    } catch (error) {
      console.error("Error loading dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("pt-PT");
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("pt-PT", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  const monthlyBudget = 500; // This could be a user setting
  const budgetUsagePercent = (stats.totalPaidThisMonth / monthlyBudget) * 100;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Dashboard
            </h2>
            <p className="text-muted-foreground mt-1">
              Visão geral das suas faturas e pagamentos
            </p>
          </div>
          <Button onClick={() => navigate("/services")} size="lg" className="gap-2">
            Adicionar Serviço
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Total a Pagar"
            value={formatCurrency(stats.totalDueAmount)}
            description="Faturas pendentes"
            icon={Euro}
            variant="default"
          />
          <StatsCard
            title="Próximo Vencimento"
            value={formatDate(stats.nextDueDate)}
            description="Data mais próxima"
            icon={Calendar}
            variant={stats.nextDueDate ? "warning" : "default"}
          />
          <StatsCard
            title="Atrasadas"
            value={stats.overdueCount.toString()}
            description="Faturas vencidas"
            icon={AlertCircle}
            variant={stats.overdueCount > 0 ? "danger" : "success"}
          />
          <StatsCard
            title="Pagas Este Mês"
            value={stats.paidThisMonth.toString()}
            description="Faturas liquidadas"
            icon={CheckCircle2}
            variant="success"
          />
        </div>

        {/* Monthly Overview */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Gasto Este Mês</CardTitle>
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-3xl font-bold">{formatCurrency(stats.totalPaidThisMonth)}</span>
                  <span className="text-sm text-muted-foreground">de {formatCurrency(monthlyBudget)}</span>
                </div>
                <Progress value={Math.min(budgetUsagePercent, 100)} className="h-2" />
              </div>
              <p className="text-xs text-muted-foreground">
                {budgetUsagePercent > 100 
                  ? `Excedeu o orçamento em ${formatCurrency(stats.totalPaidThisMonth - monthlyBudget)}`
                  : `${formatCurrency(monthlyBudget - stats.totalPaidThisMonth)} restantes este mês`
                }
              </p>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader>
              <CardTitle className="text-base">Média Mensal</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-3xl font-bold">{formatCurrency(stats.averageMonthlySpend)}</div>
                <p className="text-xs text-muted-foreground">
                  Baseado nos últimos 3 meses
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Services Overview */}
        <Card className="border-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Os Seus Serviços</CardTitle>
                <CardDescription>
                  Fornecedores de serviços ativos
                </CardDescription>
              </div>
              <Button onClick={() => navigate("/services")} variant="ghost" className="gap-2">
                Ver Todos
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-48 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : servicesWithInvoices.length === 0 ? (
              <div className="text-center py-12 space-y-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
                  <AlertCircle className="h-8 w-8 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-lg font-medium mb-1">Ainda não tem serviços registados</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Comece por adicionar o seu primeiro serviço
                  </p>
                </div>
                <Button onClick={() => navigate("/services")} size="lg">
                  Adicionar Primeiro Serviço
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {servicesWithInvoices.slice(0, 6).map((item) => (
                  <ServiceCard
                    key={item.service.id}
                    service={item.service}
                    nextInvoice={item.nextInvoice}
                    onClick={() => navigate("/services")}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="border-2 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold mb-1">Precisa de Ajuda?</h3>
                <p className="text-sm text-muted-foreground">
                  Consulte as suas faturas ou adicione novos serviços
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => navigate("/invoices")}>
                  Ver Faturas
                </Button>
                <Button onClick={() => navigate("/services")}>
                  Gerir Serviços
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
