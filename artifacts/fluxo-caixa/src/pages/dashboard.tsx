import { useGetDashboard } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Wallet, AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export default function DashboardPage() {
  const { data, isLoading, error } = useGetDashboard();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h2 className="text-2xl font-serif text-primary">Erro ao carregar o dashboard</h2>
        <p className="text-muted-foreground">Não foi possível carregar os dados financeiros.</p>
      </div>
    );
  }

  const isPositive = data.saldoAtual >= 0;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-serif font-bold text-primary">Visão Geral</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-0 shadow-lg bg-white relative overflow-hidden">
          <div className={`absolute top-0 w-full h-1 ${isPositive ? 'bg-green-500' : 'bg-destructive'}`} />
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium flex items-center gap-2">
              <Wallet className="h-4 w-4" /> Saldo Atual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-4xl md:text-5xl font-bold tracking-tight mt-2 ${isPositive ? 'text-green-600' : 'text-destructive'}`}>
              {formatCurrency(data.saldoAtual)}
            </div>
            <p className="text-sm text-muted-foreground mt-4 font-medium">
              Baseado nas entradas e saídas pagas.
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" /> A Receber (Pendente)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-primary mt-2">
              {formatCurrency(data.totalAReceber)}
            </div>
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{data.entradasPendentes}</span> entradas pendentes
              </p>
              <Link href="/entradas">
                <Button variant="link" className="text-accent h-auto p-0 text-sm">Ver todas</Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-destructive" /> A Pagar (Pendente)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-primary mt-2">
              {formatCurrency(data.totalAPagar)}
            </div>
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{data.saidasPendentes}</span> saídas pendentes
              </p>
              <Link href="/saidas">
                <Button variant="link" className="text-accent h-auto p-0 text-sm">Ver todas</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <Card className="border-0 shadow-sm bg-card border border-card-border">
          <CardHeader>
            <CardTitle className="text-primary font-serif">Entradas do Mês</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-border">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Pagas</p>
                <p className="text-xl font-bold text-green-600">{data.entradasPagas}</p>
              </div>
              <div className="w-px h-10 bg-border" />
              <div className="space-y-1 text-right">
                <p className="text-sm text-muted-foreground">Pendentes</p>
                <p className="text-xl font-bold text-accent">{data.entradasPendentes}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-card border border-card-border">
          <CardHeader>
            <CardTitle className="text-primary font-serif">Saídas do Mês</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-border">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Pagas</p>
                <p className="text-xl font-bold text-primary">{data.saidasPagas}</p>
              </div>
              <div className="w-px h-10 bg-border" />
              <div className="space-y-1 text-right">
                <p className="text-sm text-muted-foreground">Pendentes</p>
                <p className="text-xl font-bold text-destructive">{data.saidasPendentes}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
