import { useGetAvisos } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Bell, Copy, CheckCircle2, AlertCircle, Info, TrendingDown, TrendingUp, Repeat } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(dateStr: string) {
  return format(parseISO(dateStr), "dd/MM/yyyy", { locale: ptBR });
}

export default function AvisosPage() {
  const { data, isLoading, error } = useGetAvisos();
  const { toast } = useToast();

  const handleCopyMessage = (cliente: string, valor: number, vencimento: string, formaPagamento: string, dadosPagamento?: string | null) => {
    let msg = `Olá ${cliente}! Passando para lembrar que temos um pagamento de R$ ${valor.toFixed(2).replace('.', ',')} com vencimento amanhã, ${formatDate(vencimento)}. `;
    if (formaPagamento === 'pix' && dadosPagamento) {
      msg += `Chave Pix: ${dadosPagamento}. `;
    } else if (formaPagamento === 'boleto' && dadosPagamento) {
      msg += `Link do boleto: ${dadosPagamento}. `;
    }
    msg += `Qualquer dúvida, estou à disposição!`;

    navigator.clipboard.writeText(msg).then(() => {
      toast({ title: "Mensagem copiada!", description: "Pronta para colar no WhatsApp." });
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h2 className="text-2xl font-serif text-primary">Erro ao carregar avisos</h2>
      </div>
    );
  }

  const hasNoAvisos = data.entradasVencendoAmanha.length === 0 && data.saidasVencendoHoje.length === 0 && data.saidasVencendoAmanha.length === 0;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3">
        <Bell className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-serif font-bold text-primary">Central de Avisos</h1>
      </div>

      <div className="bg-card text-card-foreground p-4 rounded-lg border border-card-border flex items-start gap-3 shadow-sm">
        <Info className="h-5 w-5 text-accent mt-0.5 shrink-0" />
        <p className="text-sm font-medium">Estes avisos aparecem quando você abre o app. Nenhuma mensagem é enviada automaticamente.</p>
      </div>

      {hasNoAvisos && (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-xl border border-border shadow-sm">
          <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
          <h2 className="text-2xl font-serif text-primary">Tudo em dia!</h2>
          <p className="text-muted-foreground mt-2">Você não tem avisos pendentes para hoje ou amanhã.</p>
        </div>
      )}

      {!hasNoAvisos && (
        <div className="grid gap-6">
          {data.entradasVencendoAmanha.length > 0 && (
            <Card className="border-0 shadow-md">
              <CardHeader className="bg-card rounded-t-xl border-b border-border pb-4">
                <CardTitle className="text-primary font-serif flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" /> Cobranças de Amanhã
                </CardTitle>
                <CardDescription>Entradas pendentes vencendo amanhã.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {data.entradasVencendoAmanha.map(entrada => (
                    <div key={entrada.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white hover:bg-slate-50 transition-colors">
                      <div>
                        <p className="font-bold text-lg text-primary">{entrada.cliente}</p>
                        <p className="text-muted-foreground">{formatCurrency(entrada.valor)} • {formatDate(entrada.vencimento)}</p>
                      </div>
                      <Button variant="outline" onClick={() => handleCopyMessage(entrada.cliente, entrada.valor, entrada.vencimento, entrada.formaPagamento, entrada.dadosPagamento)} className="shrink-0 border-accent text-accent hover:bg-accent hover:text-accent-foreground">
                        <Copy className="h-4 w-4 mr-2" /> Copiar Mensagem
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {data.saidasVencendoHoje.length > 0 && (
            <Card className="border-0 shadow-md border-l-4 border-l-destructive">
              <CardHeader className="bg-red-50/50 rounded-t-xl border-b border-border pb-4">
                <CardTitle className="text-destructive font-serif flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" /> Contas a Pagar Hoje
                </CardTitle>
                <CardDescription>Saídas que vencem hoje e ainda não foram pagas.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {data.saidasVencendoHoje.map(saida => (
                    <div key={saida.id} className="p-4 flex justify-between items-center bg-white hover:bg-slate-50 transition-colors">
                      <div>
                        <p className="font-bold text-lg text-primary flex items-center gap-2">
                          {saida.descricao}
                          {saida.recorrente && (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] flex items-center gap-1">
                              <Repeat className="h-3 w-3" /> Recorrente
                            </Badge>
                          )}
                        </p>
                        <p className="text-destructive font-medium">
                          {saida.recorrente && !saida.valor ? "Valor a definir" : formatCurrency(saida.valor)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {data.saidasVencendoAmanha.length > 0 && (
            <Card className="border-0 shadow-md">
              <CardHeader className="bg-card rounded-t-xl border-b border-border pb-4">
                <CardTitle className="text-primary font-serif flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-accent" /> Contas a Pagar Amanhã
                </CardTitle>
                <CardDescription>Saídas pendentes com vencimento amanhã.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {data.saidasVencendoAmanha.map(saida => (
                    <div key={saida.id} className="p-4 flex justify-between items-center bg-white hover:bg-slate-50 transition-colors">
                      <div>
                        <p className="font-bold text-lg text-primary flex items-center gap-2">
                          {saida.descricao}
                          {saida.recorrente && (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] flex items-center gap-1">
                              <Repeat className="h-3 w-3" /> Recorrente
                            </Badge>
                          )}
                        </p>
                        <p className="text-muted-foreground">
                          {saida.recorrente && !saida.valor ? "Valor a definir" : formatCurrency(saida.valor)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
