import { useState } from "react";
import { useGetRelatorioSemanal } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, Copy, BarChart2, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { format, startOfWeek, addWeeks, subWeeks, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export default function RelatorioPage() {
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const weekStartStr = format(currentWeekStart, "yyyy-MM-dd");
  
  const { data, isLoading } = useGetRelatorioSemanal({ weekStart: weekStartStr });
  const { toast } = useToast();

  const handleCopyResumo = () => {
    if (!data) return;
    
    const startStr = format(parseISO(data.weekStart), "dd/MM", { locale: ptBR });
    const endStr = format(parseISO(data.weekEnd), "dd/MM/yyyy", { locale: ptBR });
    
    const msg = `*Relatório Semanal (${startStr} a ${endStr})*\n\n` +
                `🟢 Entradas: ${formatCurrency(data.totalEntradas)}\n` +
                `🔴 Saídas: ${formatCurrency(data.totalSaidas)}\n` +
                `💰 Saldo: ${formatCurrency(data.saldo)}`;

    navigator.clipboard.writeText(msg).then(() => {
      toast({ title: "Resumo copiado!", description: "Pronto para compartilhar no WhatsApp." });
    });
  };

  const nextWeek = () => setCurrentWeekStart(addWeeks(currentWeekStart, 1));
  const prevWeek = () => setCurrentWeekStart(subWeeks(currentWeekStart, 1));

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <BarChart2 className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-serif font-bold text-primary">Relatório Semanal</h1>
        </div>

        <div className="flex items-center bg-white border border-border rounded-lg p-1 shadow-sm w-fit">
          <Button variant="ghost" size="icon" onClick={prevWeek} className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-4 text-sm font-medium min-w-[140px] text-center">
            {format(currentWeekStart, "dd MMM", { locale: ptBR })} - {format(addWeeks(currentWeekStart, 1), "dd MMM", { locale: ptBR })}
          </span>
          <Button variant="ghost" size="icon" onClick={nextWeek} className="h-8 w-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading || !data ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-0 shadow-md bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-muted-foreground text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-500" /> Total Entradas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tracking-tight text-green-600">
                  {formatCurrency(data.totalEntradas)}
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-muted-foreground text-sm font-medium flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-destructive" /> Total Saídas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tracking-tight text-destructive">
                  {formatCurrency(data.totalSaidas)}
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md bg-white relative overflow-hidden">
              <div className={`absolute top-0 w-full h-1 ${data.saldo >= 0 ? 'bg-green-500' : 'bg-destructive'}`} />
              <CardHeader className="pb-2">
                <CardTitle className="text-muted-foreground text-sm font-medium flex items-center gap-2">
                  <Wallet className="h-4 w-4" /> Saldo da Semana
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold tracking-tight ${data.saldo >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  {formatCurrency(data.saldo)}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-0 shadow-md bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-border/50">
              <CardTitle className="text-primary font-serif text-xl">Fluxo Diário</CardTitle>
              <Button variant="outline" size="sm" onClick={handleCopyResumo} className="text-accent border-accent hover:bg-accent hover:text-accent-foreground">
                <Copy className="h-4 w-4 mr-2" /> Copiar Resumo
              </Button>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.diasSemana} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="diaSemana" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      dy={10}
                    />
                    <YAxis 
                      tickFormatter={(value) => `R$ ${value}`}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      cursor={{ fill: 'hsl(var(--muted)/0.3)' }}
                      contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    <Bar dataKey="entradas" name="Entradas" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="saidas" name="Saídas" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}