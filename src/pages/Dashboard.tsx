import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { supabase } from "@/integrations/supabase/client";
import { Euro, Calendar, AlertCircle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface DashboardStats {
  totalDueAmount: number;
  nextDueDate: string | null;
  overdueCount: number;
  paidThisMonth: number;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalDueAmount: 0,
    nextDueDate: null,
    overdueCount: 0,
    paidThisMonth: 0,
  });
  const [services, setServices] = useState<any[]>([]);
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

      setServices(servicesData || []);

      // Load invoices for stats
      const { data: invoicesData } = await supabase
        .from("invoices")
        .select(`
          *,
          service:services(issuer, category)
        `)
        .in("service_id", (servicesData || []).map(s => s.id));

      if (invoicesData) {
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
        const nextDue = pending.length > 0
          ? pending.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0].due_date
          : null;

        setStats({
          totalDueAmount: totalDue / 100,
          nextDueDate: nextDue,
          overdueCount: overdue.length,
          paidThisMonth: paidThisMonth.length,
        });
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

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">
            Visão geral das suas faturas e pagamentos
          </p>
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

        {/* Services Overview */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Os Seus Serviços</CardTitle>
                <CardDescription>
                  Fornecedores de serviços ativos
                </CardDescription>
              </div>
              <Button onClick={() => navigate("/services")}>
                Ver Todos
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">A carregar...</p>
            ) : services.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  Ainda não tem serviços registados
                </p>
                <Button onClick={() => navigate("/services")}>
                  Adicionar Primeiro Serviço
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {services.slice(0, 6).map((service) => (
                  <Card key={service.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">{service.issuer}</CardTitle>
                      <CardDescription className="text-xs">
                        {service.category || "Sem categoria"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <Badge variant={service.autopay ? "default" : "secondary"}>
                          {service.autopay ? "Autopay ON" : "Autopay OFF"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {service.contract_number || "—"}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
