import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function Settings() {
  const [profile, setProfile] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error("Error loading profile:", error);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Email copiado para a área de transferência");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Erro ao copiar");
    }
  };

  if (!profile) {
    return (
      <DashboardLayout>
        <p className="text-muted-foreground">A carregar...</p>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8 max-w-2xl">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Definições</h2>
          <p className="text-muted-foreground">
            Gerir a sua conta e preferências
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Informações da Conta</CardTitle>
            <CardDescription>
              Os seus dados pessoais e configurações
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullname">Nome Completo</Label>
              <Input
                id="fullname"
                value={profile.full_name || ""}
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Pessoal</Label>
              <Input
                id="email"
                value={profile.email}
                disabled
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-accent/50 bg-accent/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="gradient-hero bg-clip-text text-transparent">
                Email Proxy CentralPay
              </span>
            </CardTitle>
            <CardDescription>
              Utilize este email nas suas contas de fornecedores para receber
              faturas automaticamente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="proxy-email">O Seu Email Proxy</Label>
              <div className="flex gap-2">
                <Input
                  id="proxy-email"
                  value={profile.proxy_email}
                  readOnly
                  className="font-mono"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(profile.proxy_email)}
                >
                  {copied ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <h4 className="font-medium text-sm">Como usar:</h4>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Copie o seu email proxy acima</li>
                <li>Vá às contas dos seus fornecedores (EDP, MEO, etc.)</li>
                <li>Altere o email de faturação para o seu email proxy</li>
                <li>Receba e gerencie todas as faturas automaticamente aqui!</li>
              </ol>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Privacidade e Dados</CardTitle>
            <CardDescription>
              Gestão dos seus dados pessoais conforme GDPR
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              A CentralPay PT processa os seus dados de faturação com o seu
              consentimento explícito. Não custodiamos fundos e utilizamos apenas
              prestadores de serviços de pagamento licenciados.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                Exportar Dados
              </Button>
              <Button variant="outline" size="sm" className="text-destructive">
                Eliminar Conta
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
