import { useGetDashboard } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Wallet, AlertCircle, AlertTriangle, LineChart as LineChartIcon, Thermometer, Clock, PartyPopper } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDateShort(dateStr: string) {
  try {
    return format(parseISO(dateStr), "dd/MM", { locale: ptBR });
  } catch {
    return dateStr;
  }
}

interface PrevisaoDia {
  data: string;
  saldoProjetado: number;
  entradas: number;
  saidas: number;
  eventos: string[];
}

interface PrevisaoResponse {
  saldoAtual: number;
  diaCritico: string | null;
  dias: PrevisaoDia[];
}

function PrevisaoCard() {
  const { data, isLoading } = useQuery({
    queryKey: ["previsao-30dias"],
    queryFn: async () => {
      const res = await fetch("/api/previsao/30dias", { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao buscar previsão");
      return res.json() as Promise<PrevisaoResponse>;
    },
  });

  if (isLoading) {
    return <Skeleton className="h-80 w-full rounded-xl" />;
  }

  if (!data) return null;

  const temRisco = Boolean(data.diaCritico);

  const chartData = data.dias.map((d) => ({
    data: formatDateShort(d.data),
    saldo: d.saldoProjetado,
  }));

  return (
    <Card className="border-0 shadow-md">
      <CardHeader>
        <CardTitle className="text-primary font-serif flex items-center gap-2">
          <LineChartIcon className="h-5 w-5 text-accent" /> Previsão dos Próximos 30 Dias
        </CardTitle>
        <CardDescription>
          Projeção do seu saldo considerando o que já está lançado (entradas, saídas e contas recorrentes).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {temRisco && (
          <div className="flex items-start gap-3 p-4 mb-4 rounded-lg bg-destructive/10 border border-destructive/30">
            <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-destructive">Atenção: seu saldo pode ficar negativo</p>
              <p className="text-sm text-destructive/90">
                Com o que já está lançado, sua projeção fica negativa a partir de <strong>{formatDateShort(data.diaCritico!)}</strong>.
                Vale a pena revisar contas a receber ou adiar alguma saída não urgente.
              </p>
            </div>
          </div>
        )}

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EDE9DF" />
              <XAxis dataKey="data" tick={{ fontSize: 11 }} interval={4} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} width={50} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} labelFormatter={(l) => `Dia ${l}`} />
              <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" />
              <Line
                type="monotone"
                dataKey="saldo"
                stroke={temRisco ? "#ef4444" : "#16a34a"}
                strokeWidth={2.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

const SAUDE_CONFIG = {
  boa: { cor: "#16a34a", bg: "bg-green-50", border: "border-green-200", texto: "text-green-700", label: "Saudável" },
  atencao: { cor: "#eab308", bg: "bg-amber-50", border: "border-amber-200", texto: "text-amber-700", label: "Atenção" },
  critica: { cor: "#ef4444", bg: "bg-red-50", border: "border-red-200", texto: "text-red-700", label: "Crítica" },
};

function TermometroCard({ saude, mensagem }: { saude: "boa" | "atencao" | "critica"; mensagem: string }) {
  const config = SAUDE_CONFIG[saude];
  return (
    <Card className={`border shadow-md ${config.bg} ${config.border}`}>
      <CardContent className="pt-6 flex items-center gap-4">
        <div className={`w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 ${config.bg} border-2 ${config.border}`}>
          <Thermometer className={`h-7 w-7 ${config.texto}`} />
        </div>
        <div>
          <p className={`font-bold text-lg ${config.texto}`}>Saúde Financeira: {config.label}</p>
          <p className={`text-sm ${config.texto} opacity-90`}>{mensagem}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ConquistasCard({ conquistas }: { conquistas: string[] }) {
  if (conquistas.length === 0) return null;
  return (
    <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200">
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-3">
          <PartyPopper className="h-5 w-5 text-amber-600" />
          <p className="font-bold text-amber-800">Suas conquistas</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {conquistas.map((c, i) => (
            <span key={i} className="bg-white px-3 py-1.5 rounded-full text-sm font-medium text-amber-800 border border-amber-200 shadow-sm">
              {c}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface DinheiroPresoItem {
  id: number;
  cliente: string;
  valor: number;
  vencimento: string;
  diasAtraso: number;
}

function DinheiroPresoCard({ itens, total }: { itens: DinheiroPresoItem[]; total: number }) {
  if (itens.length === 0) return null;
  return (
    <Card className="border-0 shadow-md">
      <CardHeader>
        <CardTitle className="text-primary font-serif flex items-center gap-2">
          <Clock className="h-5 w-5 text-destructive" /> Onde seu dinheiro está preso
        </CardTitle>
        <CardDescription>
          {itens.length} recebimento(s) atrasado(s), somando <strong>{formatCurrency(total)}</strong>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {itens.map((item) => (
          <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-white">
            <div>
              <p className="font-medium text-primary">{item.cliente}</p>
              <p className="text-xs text-muted-foreground">Venceu em {formatDateShort(item.vencimento)}</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-destructive">{formatCurrency(item.valor)}</p>
              <p className="text-xs text-destructive/80">{item.diasAtraso} dia(s) de atraso</p>
            </div>
          </div>
        ))}
        <Link href="/entradas">
          <Button variant="link" className="text-accent h-auto p-0 text-sm mt-2">Ver todas as entradas</Button>
        </Link>
      </CardContent>
    </Card>
  );
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

      <TermometroCard saude={data.saude} mensagem={data.saudeMensagem} />

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

      <ConquistasCard conquistas={data.conquistas} />

      <PrevisaoCard />

      <DinheiroPresoCard itens={data.dinheiroPreso} total={data.totalPreso} />

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
