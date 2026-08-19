import { useState, useRef } from "react";
import { useCreateEntrada, useCreateSaida, EntradaInputFormaPagamento, EntradaInputStatus, SaidaInputStatus } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { UploadCloud, Camera as CameraIcon, Loader2, FileText, Trash2, Save, ListChecks } from "lucide-react";

interface Lancamento {
  localId: string;
  tipo: "entrada" | "saida";
  clienteDescricao: string;
  valor: string;
  vencimento: string;
  formaPagamento: string;
  dadosPagamento: string;
  status: "pago" | "pendente";
  observacao: string;
}

const NENHUMA_FORMA = "__nenhuma__";

export default function ScanPage() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [analisando, setAnalisando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const createEntrada = useCreateEntrada();
  const createSaida = useCreateSaida();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setMimeType(file.type);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setSelectedImage(result);
      setLancamentos([]);
    };
    reader.readAsDataURL(file);
  };

  const handleScan = async () => {
    if (!selectedImage) return;
    setAnalisando(true);

    try {
      const base64Data = selectedImage.split(',')[1];
      const res = await fetch("/api/scan-imagem", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagemBase64: base64Data, mimeType }),
      });
      const data = await res.json();

      if (!res.ok || data.erro) {
        toast({ title: "Erro na análise", description: data.erro || "Não foi possível extrair dados do arquivo.", variant: "destructive" });
        setAnalisando(false);
        return;
      }

      const itens: Lancamento[] = (data.lancamentos || []).map((l: any, i: number) => ({
        localId: `${Date.now()}-${i}`,
        tipo: l.tipo === "entrada" ? "entrada" : "saida",
        clienteDescricao: l.cliente || l.descricao || "",
        valor: l.valor ? String(l.valor) : "",
        vencimento: l.vencimento || format(new Date(), "yyyy-MM-dd"),
        formaPagamento: l.formaPagamento || NENHUMA_FORMA,
        dadosPagamento: l.dadosPagamento || "",
        status: l.status === "pago" ? "pago" : "pendente",
        observacao: l.observacao || "",
      }));

      if (itens.length === 0) {
        toast({ title: "Nada encontrado", description: "Não conseguimos identificar nenhum lançamento nesse arquivo.", variant: "destructive" });
      } else {
        setLancamentos(itens);
        toast({ title: `${itens.length} lançamento(s) encontrado(s)!`, description: "Revise abaixo antes de salvar." });
      }
    } catch {
      toast({ title: "Erro na análise", description: "Falha ao processar o arquivo.", variant: "destructive" });
    } finally {
      setAnalisando(false);
    }
  };

  const updateItem = (localId: string, patch: Partial<Lancamento>) => {
    setLancamentos((prev) => prev.map((l) => (l.localId === localId ? { ...l, ...patch } : l)));
  };

  const removeItem = (localId: string) => {
    setLancamentos((prev) => prev.filter((l) => l.localId !== localId));
  };

  const handleSalvarTodos = async () => {
    if (lancamentos.length === 0) return;
    setSalvando(true);

    let sucesso = 0;
    let falha = 0;

    for (const item of lancamentos) {
      try {
        if (item.tipo === "entrada") {
          await createEntrada.mutateAsync({
            data: {
              cliente: item.clienteDescricao || "Sem nome",
              valor: Number(item.valor) || 0,
              vencimento: item.vencimento,
              formaPagamento: (item.formaPagamento === NENHUMA_FORMA ? "pix" : item.formaPagamento) as EntradaInputFormaPagamento,
              dadosPagamento: item.dadosPagamento || undefined,
              status: item.status as EntradaInputStatus,
              observacao: item.observacao || undefined,
            },
          });
        } else {
          await createSaida.mutateAsync({
            data: {
              descricao: item.clienteDescricao || "Sem descrição",
              valor: Number(item.valor) || 0,
              vencimento: item.vencimento,
              formaPagamento: item.formaPagamento === NENHUMA_FORMA ? undefined : (item.formaPagamento as any),
              dadosPagamento: item.dadosPagamento || undefined,
              status: item.status as SaidaInputStatus,
              observacao: item.observacao || undefined,
            },
          });
        }
        sucesso++;
      } catch {
        falha++;
      }
    }

    queryClient.invalidateQueries();
    setSalvando(false);

    if (falha === 0) {
      toast({ title: `${sucesso} lançamento(s) salvo(s) com sucesso!` });
      setLancamentos([]);
      setSelectedImage(null);
      setFileName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } else {
      toast({ title: `${sucesso} salvo(s), ${falha} falharam`, description: "Verifique os itens restantes e tente novamente.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <CameraIcon className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-serif font-bold text-primary">Adicionar por Foto ou Arquivo</h1>
      </div>

      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="font-serif text-primary">Upload</CardTitle>
          <CardDescription>Envie o print ou PDF de um PIX, boleto, fatura ou lista de contas — pode ter quantos lançamentos precisar, a IA lê todos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div 
            className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-colors cursor-pointer min-h-[220px] ${selectedImage ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-primary hover:bg-slate-50'}`}
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              accept="image/*,application/pdf" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleFileChange}
            />
            
            {selectedImage ? (
              <div className="space-y-4 w-full">
                {mimeType === "application/pdf" ? (
                  <div className="flex flex-col items-center justify-center w-full h-[160px] rounded-lg overflow-hidden border border-border bg-slate-50 gap-3">
                    <FileText className="h-14 w-14 text-primary/60" />
                    <p className="text-sm text-muted-foreground px-4 truncate max-w-full">{fileName}</p>
                  </div>
                ) : (
                  <div className="relative w-full h-[160px] rounded-lg overflow-hidden border border-border">
                    <img src={selectedImage} alt="Preview" className="object-contain w-full h-full" />
                  </div>
                )}
                <Button variant="outline" className="w-full">Trocar arquivo</Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto">
                  <UploadCloud className="h-8 w-8" />
                </div>
                <div>
                  <p className="font-medium text-lg text-foreground">Toque para enviar ou tirar foto</p>
                  <p className="text-sm text-muted-foreground mt-1">PNG, JPG, WEBP ou PDF</p>
                </div>
              </div>
            )}
          </div>

          <Button 
            className="w-full bg-accent text-accent-foreground hover:bg-accent/90 shadow-md h-12 text-lg" 
            disabled={!selectedImage || analisando}
            onClick={handleScan}
          >
            {analisando ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Analisando arquivo...</>
            ) : (
              <><ListChecks className="mr-2 h-5 w-5" /> Analisar Arquivo</>
            )}
          </Button>
        </CardContent>
      </Card>

      {lancamentos.length > 0 && (
        <Card className="border-0 shadow-md border-l-4 border-l-primary">
          <CardHeader className="bg-primary/5 border-b border-border">
            <CardTitle className="text-primary font-serif flex items-center justify-between">
              <span>{lancamentos.length} Lançamento(s) Encontrado(s)</span>
            </CardTitle>
            <CardDescription>Revise, edite se precisar, e salve todos de uma vez.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            {lancamentos.map((item, idx) => (
              <div key={item.localId} className="p-4 rounded-lg border border-border bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Lançamento {idx + 1}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeItem(item.localId)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Tipo</Label>
                    <Select value={item.tipo} onValueChange={(v) => updateItem(item.localId, { tipo: v as "entrada" | "saida" })}>
                      <SelectTrigger className="bg-white h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="entrada">Entrada a Receber</SelectItem>
                        <SelectItem value="saida">Saída a Pagar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Status</Label>
                    <Select value={item.status} onValueChange={(v) => updateItem(item.localId, { status: v as "pago" | "pendente" })}>
                      <SelectTrigger className="bg-white h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pendente">Pendente</SelectItem>
                        <SelectItem value="pago">Pago</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">{item.tipo === "entrada" ? "Cliente" : "Descrição / Fornecedor"}</Label>
                  <Input className="bg-white h-9" value={item.clienteDescricao} onChange={(e) => updateItem(item.localId, { clienteDescricao: e.target.value })} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Valor (R$)</Label>
                    <Input className="bg-white h-9" type="number" step="0.01" value={item.valor} onChange={(e) => updateItem(item.localId, { valor: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Vencimento</Label>
                    <Input className="bg-white h-9" type="date" value={item.vencimento} onChange={(e) => updateItem(item.localId, { vencimento: e.target.value })} />
                  </div>
                </div>

                {item.observacao && (
                  <p className="text-xs text-muted-foreground italic">{item.observacao}</p>
                )}
              </div>
            ))}

            <Button 
              className="w-full h-12 text-lg bg-primary" 
              disabled={salvando}
              onClick={handleSalvarTodos}
            >
              {salvando ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Salvando...</>
              ) : (
                <><Save className="mr-2 h-5 w-5" /> Salvar Todos os {lancamentos.length} Lançamentos</>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
