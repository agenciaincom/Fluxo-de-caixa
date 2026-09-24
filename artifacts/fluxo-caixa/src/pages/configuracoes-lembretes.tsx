
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Bell, Copy, Calendar, Smartphone, Mail } from "lucide-react";

interface LembretesConfigResponse {
  incluirPendentes: boolean;
  incluirVencendoSemana: boolean;
  incluirProvisoes: boolean;
  urlCalendario: string;
}

export default function ConfiguracoesLembretesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [salvando, setSalvando] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["lembretes-config"],
    queryFn: async () => {
      const res = await fetch("/api/lembretes/config", { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao buscar configuração");
      return res.json() as Promise<LembretesConfigResponse>;
    },
  });

  const [config, setConfig] = useState<LembretesConfigResponse | null>(null);

  useEffect(() => {
    if (data) setConfig(data);
  }, [data]);

  const salvar = async (novo: Partial<LembretesConfigResponse>) => {
    if (!config) return;
    const atualizado = { ...config, ...novo };
    setConfig(atualizado);
    setSalvando(true);
    try {
      await fetch("/api/lembretes/config", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(atualizado),
      });
      queryClient.invalidateQueries({ queryKey: ["lembretes-config"] });
    } finally {
      setSalvando(false);
    }
  };

  const copiarLink = () => {
    if (!config) return;
    navigator.clipboard.writeText(config.urlCalendario);
    toast({ title: "Link copiado!", description: "Cole no seu app de Calendário ou Lembretes." });
  };

  if (isLoading || !config) {
    return <div className="text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-8 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3">
        <Bell className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-serif font-bold text-primary">Configurações de Lembretes</h1>
      </div>

      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="text-primary font-serif">O que incluir</CardTitle>
          <CardDescription>Escolha quais avisos você quer receber no seu calendário/lembretes do celular.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-white">
            <div>
              <Label className="font-medium">Contas pendentes de pagamento</Label>
              <p className="text-xs text-muted-foreground">Todas as entradas e saídas ainda não pagas</p>
            </div>
            <Switch checked={config.incluirPendentes} onCheckedChange={(v) => salvar({ incluirPendentes: v })} disabled={salvando} />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-white">
            <div>
              <Label className="font-medium">Contas a vencer na semana</Label>
              <p className="text-xs text-muted-foreground">Aviso destacado para o que vence nos próximos 7 dias</p>
            </div>
            <Switch checked={config.incluirVencendoSemana} onCheckedChange={(v) => salvar({ incluirVencendoSemana: v })} disabled={salvando} />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-white">
            <div>
              <Label className="font-medium">Provisões da semana</Label>
              <p className="text-xs text-muted-foreground">Contas recorrentes (água, luz...) que devem vencer nos próximos 7 dias, mesmo sem valor definido</p>
            </div>
            <Switch checked={config.incluirProvisoes} onCheckedChange={(v) => salvar({ incluirProvisoes: v })} disabled={salvando} />
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-md border-l-4 border-l-primary">
        <CardHeader>
          <CardTitle className="text-primary font-serif flex items-center gap-2">
            <Calendar className="h-5 w-5" /> Adicionar ao seu celular
          </CardTitle>
          <CardDescription>
            Copie o link abaixo e adicione como uma "assinatura de calendário" no app de Calendário ou Lembretes do seu celular. Ele atualiza sozinho a cada poucas horas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input readOnly value={config.urlCalendario} className="bg-slate-50 text-sm" />
            <Button variant="outline" size="icon" onClick={copiarLink}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid gap-3 text-sm">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-border">
              <Smartphone className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
              <p><strong>iPhone/iPad:</strong> Ajustes → Calendário → Contas → Adicionar Conta → Outro → Adicionar Assinatura de Calendário → cole o link.</p>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-border">
              <Smartphone className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
              <p><strong>Android/Google Calendar:</strong> No site calendar.google.com → Outros calendários → Por URL → cole o link.</p>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <Mail className="h-4 w-4 text-amber-700 flex-shrink-0 mt-0.5" />
              <p className="text-amber-800"><strong>E-mail:</strong> ainda não disponível — só calendário/lembretes do celular por enquanto.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
