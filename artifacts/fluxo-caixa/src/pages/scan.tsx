import { useState, useRef } from "react";
import { useScanImagem, useCreateEntrada, useCreateSaida, ScanImagemResultTipo, EntradaInputFormaPagamento, EntradaInputStatus, SaidaInputStatus } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { UploadCloud, Camera as CameraIcon, ArrowRight, Loader2, Image as ImageIcon, FileText } from "lucide-react";

export default function ScanPage() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const scanImagem = useScanImagem();
  const createEntrada = useCreateEntrada();
  const createSaida = useCreateSaida();
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const isPdf = mimeType === "application/pdf";

  const [formState, setFormState] = useState<{
    tipo: ScanImagemResultTipo;
    clienteDescricao: string;
    valor: string;
    vencimento: string;
    formaPagamento: string;
    dadosPagamento: string;
    status: string;
    observacao: string;
  } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setMimeType(file.type);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setSelectedImage(result);
      setFormState(null);
    };
    reader.readAsDataURL(file);
  };

  const handleScan = () => {
    if (!selectedImage) return;

    const base64Data = selectedImage.split(',')[1];

    scanImagem.mutate(
      { data: { imagemBase64: base64Data, mimeType } },
      {
        onSuccess: (result) => {
          if (result.erro) {
            toast({ title: "Erro na análise", description: result.erro, variant: "destructive" });
            return;
          }

          setFormState({
            tipo: result.tipo || "saida",
            clienteDescricao: result.cliente || result.descricao || "",
            valor: result.valor ? result.valor.toString() : "",
            vencimento: result.vencimento || format(new Date(), "yyyy-MM-dd"),
            formaPagamento: result.formaPagamento || "pix",
            dadosPagamento: result.dadosPagamento || "",
            status: result.status || "pendente",
            observacao: result.observacao || "",
          });
          toast({ title: "Arquivo analisado!", description: "Revise os dados antes de salvar." });
        },
        onError: () => {
          toast({ title: "Erro na análise", description: "Não foi possível extrair dados do arquivo.", variant: "destructive" });
        }
      }
    );
  };

  const handleSave = () => {
    if (!formState) return;

    const commonData = {
      valor: Number(formState.valor),
      vencimento: formState.vencimento,
      observacao: formState.observacao,
    };

    if (formState.tipo === "entrada") {
      createEntrada.mutate(
        {
          data: {
            ...commonData,
            cliente: formState.clienteDescricao,
            formaPagamento: formState.formaPagamento as EntradaInputFormaPagamento,
            dadosPagamento: formState.dadosPagamento,
            status: formState.status as EntradaInputStatus,
          }
        },
        {
          onSuccess: () => {
            queryClient.invalidateQueries();
            toast({ title: "Entrada salva com sucesso!" });
            resetState();
          }
        }
      );
    } else {
      createSaida.mutate(
        {
          data: {
            ...commonData,
            descricao: formState.clienteDescricao,
            status: formState.status as SaidaInputStatus,
          }
        },
        {
          onSuccess: () => {
            queryClient.invalidateQueries();
            toast({ title: "Saída salva com sucesso!" });
            resetState();
          }
        }
      );
    }
  };

  const resetState = () => {
    setSelectedImage(null);
    setMimeType("");
    setFileName("");
    setFormState(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <CameraIcon className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-serif font-bold text-primary">Adicionar por Foto ou Arquivo</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="font-serif text-primary">Upload</CardTitle>
            <CardDescription>Envie o print ou PDF de um PIX, boleto, nota fiscal ou comprovante.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div 
              className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-colors cursor-pointer min-h-[300px] ${selectedImage ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-primary hover:bg-slate-50'}`}
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
                  {isPdf ? (
                    <div className="flex flex-col items-center justify-center w-full h-[200px] rounded-lg overflow-hidden border border-border bg-slate-50 gap-3">
                      <FileText className="h-16 w-16 text-primary/60" />
                      <p className="text-sm text-muted-foreground px-4 truncate max-w-full">{fileName}</p>
                    </div>
                  ) : (
                    <div className="relative w-full h-[200px] rounded-lg overflow-hidden border border-border">
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
              disabled={!selectedImage || scanImagem.isPending}
              onClick={handleScan}
            >
              {scanImagem.isPending ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Analisando arquivo...</>
              ) : (
                <><ImageIcon className="mr-2 h-5 w-5" /> Analisar Arquivo</>
              )}
            </Button>
          </CardContent>
        </Card>

        {formState ? (
          <Card className="border-0 shadow-md border-l-4 border-l-primary animate-in slide-in-from-right-4">
            <CardHeader className="bg-primary/5 border-b border-border">
              <CardTitle className="font-serif text-primary flex items-center gap-2">
                <ArrowRight className="h-5 w-5 text-accent" /> Dados Extraídos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-2">
                <Label>Tipo de Registro</Label>
                <Select value={formState.tipo || "saida"} onValueChange={(v) => setFormState({...formState, tipo: v as ScanImagemResultTipo})}>
                  <SelectTrigger className="bg-white border-primary/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entrada">Entrada a Receber</SelectItem>
                    <SelectItem value="saida">Saída a Pagar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{formState.tipo === "entrada" ? "Cliente" : "Descrição / Fornecedor"}</Label>
                <Input value={formState.clienteDescricao} onChange={e => setFormState({...formState, clienteDescricao: e.target.value})} className="bg-white" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Valor (R$)</Label>
                  <Input type="number" step="0.01" value={formState.valor} onChange={e => setFormState({...formState, valor: e.target.value})} className="bg-white" />
                </div>
                <div className="space-y-2">
                  <Label>Vencimento</Label>
                  <Input type="date" value={formState.vencimento} onChange={e => setFormState({...formState, vencimento: e.target.value})} className="bg-white" />
                </div>
              </div>
              
              {formState.tipo === "entrada" && (
                <>
                  <div className="space-y-2">
                    <Label>Forma de Pagamento</Label>
                    <Select value={formState.formaPagamento} onValueChange={(v) => setFormState({...formState, formaPagamento: v})}>
                      <SelectTrigger className="bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pix">Pix</SelectItem>
                        <SelectItem value="boleto">Boleto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Dados de Pagamento (Chave ou Link)</Label>
                    <Input value={formState.dadosPagamento} onChange={e => setFormState({...formState, dadosPagamento: e.target.value})} className="bg-white" />
                  </div>
                </>
              )}
              
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formState.status} onValueChange={(v) => setFormState({...formState, status: v})}>
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
            <CardFooter className="bg-slate-50 border-t border-border rounded-b-xl flex justify-end gap-3 pt-4">
              <Button variant="ghost" onClick={resetState}>Cancelar</Button>
              <Button 
                className={formState.tipo === "entrada" ? "bg-primary" : "bg-destructive hover:bg-destructive/90 text-destructive-foreground"} 
                onClick={handleSave}
                disabled={createEntrada.isPending || createSaida.isPending}
              >
                {(createEntrada.isPending || createSaida.isPending) ? "Salvando..." : `Salvar como ${formState.tipo === "entrada" ? "Entrada" : "Saída"}`}
              </Button>
            </CardFooter>
          </Card>
        ) : (
          <div className="hidden lg:flex flex-col items-center justify-center text-center p-8 bg-slate-50 border border-border rounded-xl shadow-sm text-muted-foreground">
            <ArrowRight className="h-12 w-12 text-border mb-4" />
            <p className="text-lg">Envie e analise uma foto ou PDF para preencher os dados automaticamente.</p>
          </div>
        )}
      </div>
    </div>
  );
}
