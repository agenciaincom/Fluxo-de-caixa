import { useState, useMemo } from "react";
import { useListEntradas, useCreateEntrada, useUpdateEntrada, useDeleteEntrada, getListEntradasQueryKey, Entrada, EntradaInputFormaPagamento, EntradaInputStatus } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Trash2, CheckCircle2, Circle, FileText, Tag, Copy, Eye } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(dateStr: string) {
  try {
    return format(parseISO(dateStr), "dd/MM/yyyy", { locale: ptBR });
  } catch(e) {
    return dateStr;
  }
}

const SEM_CENTRO = "__sem_centro__";

export default function EntradasPage() {
  const { data: entradas = [], isLoading } = useListEntradas();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const createEntrada = useCreateEntrada();
  const updateEntrada = useUpdateEntrada();
  const deleteEntrada = useDeleteEntrada();

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [filtroCentroCusto, setFiltroCentroCusto] = useState<string>("todos");
  const [detalheEntrada, setDetalheEntrada] = useState<Entrada | null>(null);
  const [formData, setFormData] = useState({
    cliente: "",
    valor: "",
    vencimento: format(new Date(), "yyyy-MM-dd"),
    formaPagamento: "pix" as EntradaInputFormaPagamento,
    dadosPagamento: "",
    status: "pendente" as EntradaInputStatus,
    observacao: "",
    centroCusto: "",
    contaBancaria: "",
    dataPagamento: "",
  });

  const centrosCusto = useMemo(() => {
    const set = new Set<string>();
    entradas.forEach((e) => {
      if (e.centroCusto) set.add(e.centroCusto);
    });
    return Array.from(set).sort();
  }, [entradas]);

  const contasBancarias = useMemo(() => {
    const set = new Set<string>();
    entradas.forEach((e) => {
      if (e.contaBancaria) set.add(e.contaBancaria);
    });
    return Array.from(set).sort();
  }, [entradas]);

  const entradasFiltradas = useMemo(() => {
    if (filtroCentroCusto === "todos") return entradas;
    if (filtroCentroCusto === SEM_CENTRO) return entradas.filter((e) => !e.centroCusto);
    return entradas.filter((e) => e.centroCusto === filtroCentroCusto);
  }, [entradas, filtroCentroCusto]);

  const toggleStatus = (entrada: Entrada) => {
    const newStatus = entrada.status === "pago" ? "pendente" : "pago";
    updateEntrada.mutate(
      { id: entrada.id, data: { status: newStatus } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListEntradasQueryKey() });
          toast({ title: "Status atualizado!" });
        }
      }
    );
  };

  const handleDelete = (id: number) => {
    if (window.confirm("Tem certeza que deseja excluir esta entrada?")) {
      deleteEntrada.mutate(
        { id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListEntradasQueryKey() });
            toast({ title: "Entrada excluída com sucesso." });
          }
        }
      );
    }
  };

  const handleCopy = (texto: string) => {
    navigator.clipboard.writeText(texto);
    toast({ title: "Copiado!", description: "Dado de pagamento copiado para a área de transferência." });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createEntrada.mutate(
      { 
        data: {
          ...formData,
          valor: Number(formData.valor),
          centroCusto: formData.centroCusto || undefined,
          contaBancaria: formData.contaBancaria || undefined,
          dataPagamento: formData.dataPagamento || undefined,
        } 
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListEntradasQueryKey() });
          toast({ title: "Entrada criada com sucesso!" });
          setIsSheetOpen(false);
          setFormData({
            cliente: "", valor: "", vencimento: format(new Date(), "yyyy-MM-dd"),
            formaPagamento: "pix", dadosPagamento: "", status: "pendente", observacao: "",
            centroCusto: "", contaBancaria: "", dataPagamento: ""
          });
        }
      }
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-serif font-bold text-primary">Contas a Receber</h1>
        
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetTrigger asChild>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-md">
              <Plus className="mr-2 h-4 w-4" /> Nova Entrada
            </Button>
          </SheetTrigger>
          <SheetContent className="overflow-y-auto w-full sm:max-w-md bg-background border-l border-border">
            <SheetHeader className="mb-6">
              <SheetTitle className="font-serif text-2xl text-primary">Nova Entrada</SheetTitle>
              <SheetDescription>Registre um novo valor a receber.</SheetDescription>
            </SheetHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cliente">Cliente *</Label>
                <Input id="cliente" required value={formData.cliente} onChange={e => setFormData({...formData, cliente: e.target.value})} className="bg-white" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="valor">Valor (R$) *</Label>
                <Input id="valor" type="number" step="0.01" min="0.01" required value={formData.valor} onChange={e => setFormData({...formData, valor: e.target.value})} className="bg-white" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vencimento">Data de Vencimento *</Label>
                <Input id="vencimento" type="date" required value={formData.vencimento} onChange={e => setFormData({...formData, vencimento: e.target.value})} className="bg-white" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="formaPagamento">Forma de Pagamento *</Label>
                <Select value={formData.formaPagamento} onValueChange={(v) => setFormData({...formData, formaPagamento: v as EntradaInputFormaPagamento})}>
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
                <Label htmlFor="dadosPagamento">Dados de Pagamento (Chave Pix ou Link/Código do Boleto)</Label>
                <Input id="dadosPagamento" value={formData.dadosPagamento} onChange={e => setFormData({...formData, dadosPagamento: e.target.value})} className="bg-white" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="centroCusto">Centro de Custo</Label>
                <Input id="centroCusto" placeholder="Ex: Baruch Máquinas, Prima, Lavanderia..." value={formData.centroCusto} onChange={e => setFormData({...formData, centroCusto: e.target.value})} className="bg-white" list="centros-custo-sugestoes" />
                <datalist id="centros-custo-sugestoes">
                  {centrosCusto.map((c) => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contaBancaria">Conta Bancária</Label>
                  <Input id="contaBancaria" placeholder="Ex: Inter, Nubank..." value={formData.contaBancaria} onChange={e => setFormData({...formData, contaBancaria: e.target.value})} className="bg-white" list="contas-bancarias-sugestoes" />
                  <datalist id="contas-bancarias-sugestoes">
                    {contasBancarias.map((c) => <option key={c} value={c} />)}
                  </datalist>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dataPagamento">Data que Recebeu</Label>
                  <Input id="dataPagamento" type="date" value={formData.dataPagamento} onChange={e => setFormData({...formData, dataPagamento: e.target.value})} className="bg-white" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status *</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({...formData, status: v as EntradaInputStatus})}>
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="observacao">Observação</Label>
                <Textarea id="observacao" value={formData.observacao} onChange={e => setFormData({...formData, observacao: e.target.value})} className="bg-white" />
              </div>
              <Button type="submit" className="w-full mt-6 bg-primary" disabled={createEntrada.isPending}>
                {createEntrada.isPending ? "Salvando..." : "Salvar Entrada"}
              </Button>
            </form>
          </SheetContent>
        </Sheet>
      </div>

      {centrosCusto.length > 0 && (
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <Select value={filtroCentroCusto} onValueChange={setFiltroCentroCusto}>
            <SelectTrigger className="bg-white w-full sm:w-64">
              <SelectValue placeholder="Filtrar por centro de custo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os centros de custo</SelectItem>
              {centrosCusto.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
              <SelectItem value={SEM_CENTRO}>Sem centro de custo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : entradasFiltradas.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-border shadow-sm">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-serif text-primary">Nenhuma entrada registrada</h3>
          <p className="text-muted-foreground">Clique em "Nova Entrada" para começar.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {entradasFiltradas.map((entrada) => {
            const isPago = entrada.status === "pago";
            return (
              <div key={entrada.id} className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 rounded-xl border shadow-sm transition-all bg-white hover:border-primary/30 cursor-pointer ${isPago ? 'border-border opacity-80' : 'border-card-border'}`} onClick={() => setDetalheEntrada(entrada)}>
                <div className="flex items-start gap-4">
                  <button onClick={(ev) => { ev.stopPropagation(); toggleStatus(entrada); }} className={`mt-1 sm:mt-0 flex-shrink-0 transition-colors ${isPago ? 'text-green-500 hover:text-green-600' : 'text-muted-foreground hover:text-accent'}`}>
                    {isPago ? <CheckCircle2 className="h-6 w-6" /> : <Circle className="h-6 w-6" />}
                  </button>
                  <div className="space-y-1">
                    <p className={`font-bold text-lg sm:text-xl transition-colors ${isPago ? 'text-muted-foreground line-through decoration-muted-foreground/30' : 'text-primary'}`}>
                      {entrada.cliente}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className={`font-medium ${isPago ? 'text-muted-foreground' : 'text-green-600'}`}>
                        {formatCurrency(entrada.valor)}
                      </span>
                      <span className="text-muted-foreground">• {formatDate(entrada.vencimento)}</span>
                      <Badge variant="outline" className="bg-slate-50 uppercase text-[10px] tracking-wider font-semibold ml-2">
                        {entrada.formaPagamento}
                      </Badge>
                      {entrada.centroCusto && (
                        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[10px] tracking-wider">
                          {entrada.centroCusto}
                        </Badge>
                      )}
                      <Badge variant={isPago ? "default" : "secondary"} className={isPago ? "bg-green-100 text-green-700 hover:bg-green-100 uppercase text-[10px] tracking-wider" : "uppercase text-[10px] tracking-wider"}>
                        {entrada.status}
                      </Badge>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 sm:mt-0 flex items-center justify-end gap-2">
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary hover:bg-primary/10" onClick={(ev) => { ev.stopPropagation(); setDetalheEntrada(entrada); }}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={(ev) => { ev.stopPropagation(); handleDelete(entrada.id); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!detalheEntrada} onOpenChange={(open) => !open && setDetalheEntrada(null)}>
        <DialogContent className="bg-background">
          {detalheEntrada && (
            <>
              <DialogHeader>
                <DialogTitle className="font-serif text-primary">{detalheEntrada.cliente}</DialogTitle>
                <DialogDescription>Detalhes da entrada</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">Valor</span>
                  <span className="font-bold text-green-600">{formatCurrency(detalheEntrada.valor)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">Vencimento</span>
                  <span>{formatDate(detalheEntrada.vencimento)}</span>
                </div>
                {detalheEntrada.dataPagamento && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground text-sm">Recebido em</span>
                    <span>{formatDate(detalheEntrada.dataPagamento)}</span>
                  </div>
                )}
                {detalheEntrada.contaBancaria && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground text-sm">Conta Bancária</span>
                    <span>{detalheEntrada.contaBancaria}</span>
                  </div>
                )}
                {detalheEntrada.centroCusto && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground text-sm">Centro de Custo</span>
                    <span>{detalheEntrada.centroCusto}</span>
                  </div>
                )}
                {detalheEntrada.observacao && (
                  <div className="pt-2 border-t border-border">
                    <span className="text-muted-foreground text-sm">Observação</span>
                    <p className="text-sm mt-1">{detalheEntrada.observacao}</p>
                  </div>
                )}
                {detalheEntrada.dadosPagamento && (
                  <div className="pt-3 border-t border-border">
                    <Label className="text-sm text-muted-foreground mb-1 block">
                      {detalheEntrada.formaPagamento === "pix" ? "Chave Pix" : "Código do Boleto / Link"}
                    </Label>
                    <div className="flex gap-2">
                      <Input readOnly value={detalheEntrada.dadosPagamento} className="bg-slate-50 text-sm" />
                      <Button type="button" variant="outline" size="icon" onClick={() => handleCopy(detalheEntrada.dadosPagamento!)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
