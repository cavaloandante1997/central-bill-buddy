import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { LogOut, Settings, Home, Receipt, CreditCard, Upload } from "lucide-react";
import { toast } from "sonner";
import { InvoiceUploadDialog } from "@/components/invoices/InvoiceUploadDialog";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.success("Sessão terminada com sucesso");
      navigate("/auth");
    } catch (error: any) {
      toast.error("Erro ao terminar sessão");
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-8">
              <h1 className="text-2xl font-bold gradient-hero bg-clip-text text-transparent">
                CentralPay PT
              </h1>
              <nav className="hidden md:flex items-center space-x-6">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/")}
                  className="flex items-center gap-2"
                >
                  <Home className="h-4 w-4" />
                  Dashboard
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/services")}
                  className="flex items-center gap-2"
                >
                  <Receipt className="h-4 w-4" />
                  Serviços
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/invoices")}
                  className="flex items-center gap-2"
                >
                  <CreditCard className="h-4 w-4" />
                  Faturas
                </Button>
              </nav>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                onClick={() => setUploadDialogOpen(true)}
                className="gap-2"
                size="sm"
              >
                <Upload className="h-4 w-4" />
                Carregar Fatura
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/settings")}
                title="Definições"
              >
                <Settings className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                title="Terminar sessão"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>

      {/* Invoice Upload Dialog */}
      <InvoiceUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onSuccess={() => {
          setRefreshKey(prev => prev + 1);
          // Trigger a page refresh or callback if needed
        }}
      />
    </div>
  );
}
