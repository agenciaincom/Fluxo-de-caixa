import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { UploadCloud, CheckCircle2, XCircle, Scale, Loader2, FileText } from "lucide-react";

interface ConciliacaoItem {
  id: number;
  data: string | null;
  valor: string;
  tipo: string | null;
  descricao: string | null;
  status: "correspondido" | "nao_encontrado";
}

interface ConciliacaoBatch {
  id: number;
  tipo: string;
  totalItens: number;
  totalCorrespondidos: number;
  createdAt: string;
  itens: ConciliacaoItem[];
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(dateStr: string) {
  try {
    return format(parseISO(dateStr), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return dateStr;
  }
}

function AssinarConciliacao() {
  const [loading, setLoading] = useState(false);

  const { data: status } = useQuery({
    queryKey: ["billing-status-conciliacao"],
    queryFn: async () => {
      const res = await fetch("/api/billing/status-conciliacao", { credentials: "include" });
      return res.json() as Promise<{ precoPacote: boolean }>;
    },
  });

  const assinar = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/checkout-conciliacao", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setLoading(false);
    } catch {
      setLoading(false);
    }
  };

  const precoPacote = status?.precoPacote;

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-border p-8 text-center">
        <Scale className="h-10 w-10 text-primary mx-auto mb-3" />
        <h1 className="text-2xl font-bold text-primary mb-2">Conciliação de Pagamentos</h1>
        <p className="text-muted-foreground mb-6">
          Confira automaticamente se todo Pix, cartão e outros recebimentos que passaram na empresa
          entraram certinho nas contas.
        </p>
        <Button onClick={assinar} disabled={loading} className="w-full bg-primary h-12 text-lg">
          {loading ? "Carregando..." : precoPacote ? "Assinar por R$ 39,90/mês" : "Assinar por R$ 49,90/mês"}
        </Button>
        {precoPacote && (
          <p className="text-xs text-muted-foreground mt-3">Preço com desconto por já ter o plano principal ativo.</p>
        )}
      </div>
    </div>
  );
}

export default function ConciliacaoPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState("");
  const [fileName, setFileName] = useState("");
  const [tipoDocumento, setTipoDocumento] = useState<"comprovante" | "maquininha" | "extrato">("comprovante");
  const [analisando, setAnalisando] = useState(false);
  const [resultado, setResultado] = useState<{ conciliacao: ConciliacaoBatch; itens: ConciliacaoItem[] } | null>(null);

  const { data: statusData, isLoading: statusLoading } = useQuery({
    queryKey: ["billing-status-conciliacao"],
    queryFn: async () => {
      const res = await fetch("/api/billing/status-conciliacao", { credentials: "include" });
      return res.json() as Promise<{ active: boolean }>;
    },
  });

  const { data: historico, refetch: refetchHistorico } = useQuery({
    queryKey: ["conciliacao-historico"],
    queryFn: async () => {
      const res = await fetch("/api/conciliacao", { credentials: "include" });
      if (!res.ok) return [];
      return res.json() as Promise<ConciliacaoBatch[]>;
    },
    enabled: Boolean(statusData?.active),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMimeType(file.type);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setSelectedFile(ev.target?.result as string);
      setResultado(null);
    };
    reader.readAsDataURL(file);
  };

  const handleAnalisar = async () => {
    if (!selectedFile) return;
    setAnalisando(true);
    try {
      const base64Data = selectedFile.split(",")[1];
      const res = await fetch("/api/conciliacao/upload", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ arquivoBase64: base64Data, mimeType, tipo: tipoDocumento }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Erro", description: data.erro || "Não foi possível processar o arquivo.", variant: "destructive" });
        return;
      }
      setResultado(data);
      refetchHistorico();
      toast({ title: "Conciliação concluída!", description: `${data.conciliacao.totalCorrespondidos} de ${data.conciliacao.totalItens} transações encontradas.` });
    } catch {
      toast({ title: "Erro", description: "Falha ao processar arquivo.", variant: "destructive" });
    } finally {
      setAnalisando(false);
    }
  };

  if (statusLoading) {
    return <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">Carregando...</div>;
  }

  if (!statusData?.active) {
    return <AssinarConciliacao />;
  }

  const listaItens = resultado?.itens || [];

  return (
    <div className="space-y-8 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3">
        <Scale className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-serif font-bold text-primary">Conciliação de Pagamentos</h1>
      </div>

      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="font-serif text-primary">Enviar documento</CardTitle>
          <CardDescription>Comprovante, relatório da maquininha ou extrato bancário em PDF ou foto.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={tipoDocumento} onValueChange={(v) => setTipoDocumento(v as any)}>
            <SelectTrigger className="bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="comprovante">Comprovante de pagamento</SelectItem>
              <SelectItem value="maquininha">Relatório da maquininha</SelectItem>
              <SelectItem value="extrato">Extrato bancário (PDF)</SelectItem>
            </SelectContent>
          </Select>

          <div
            className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer min-h-[160px] ${selectedFile ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary"}`}
            onClick={() => fileInputRef.current?.click()}
          >
            <input type="file" accept="image/*,application/pdf" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
            {selectedFile ? (
              <div className="space-y-2">
                <FileText className="h-10 w-10 text-primary/60 mx-auto" />
                <p className="text-sm text-muted-foreground truncate max-w-xs">{fileName}</p>
              </div>
            ) : (
              <div className="space-y-2">
                <UploadCloud className="h-10 w-10 text-primary/60 mx-auto" />
                <p className="text-muted-foreground">Toque para enviar</p>
              </div>
            )}
          </div>

          <Button className="w-full bg-primary h-12" disabled={!selectedFile || analisando} onClick={handleAnalisar}>
            {analisando ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Conciliando...</>
            ) : (
              "Conciliar"
            )}
          </Button>
        </CardContent>
      </Card>

      {resultado && (
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="font-serif text-primary">
              Resultado — {resultado.conciliacao.totalCorrespondidos} de {resultado.conciliacao.totalItens} encontradas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {listaItens.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-white">
                <div className="flex items-center gap-3">
                  {item.status === "correspondido" ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                  ) : (
                    <XCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                  )}
                  <div>
                    <p className="font-medium">{formatCurrency(Number(item.valor))}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.data ? formatDate(item.data) : "sem data"} {item.descricao ? `• ${item.descricao}` : ""}
                    </p>
                  </div>
                </div>
                <Badge variant={item.status === "correspondido" ? "default" : "secondary"} className={item.status === "correspondido" ? "bg-green-100 text-green-700" : "bg-destructive/10 text-destructive"}>
                  {item.status === "correspondido" ? "Encontrado" : "Não encontrado"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {historico && historico.length > 0 && (
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="font-serif text-primary">Histórico</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {historico.map((h) => (
              <div key={h.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-white text-sm">
                <span className="capitalize">{h.tipo}</span>
                <span className="text-muted-foreground">{formatDate(h.createdAt)}</span>
                <Badge variant="outline">{h.totalCorrespondidos}/{h.totalItens} encontradas</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
