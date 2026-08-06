import { useState, useMemo } from "react";
import { useListSaidas, useCreateSaida, useUpdateSaida, useDeleteSaida, getListSaidasQueryKey, Saida, SaidaInputStatus, SaidaInputFormaPagamento } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Trash2, CheckCircle2, Circle, FileText, Tag, Copy, Eye, Repeat } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(dateStr: string) {
  try {
    return format(parseISO(dateStr), "dd/MM/yyyy", { locale: ptBR });
  } catch(e) {
    return dateStr;
  }
}

const SEM_CENTRO = "__sem_centro__";
const NENHUMA_FORMA = "__nenhuma__";

export default function SaidasPage() {
  const { data: saidas = [], isLoading } = useListSaidas();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const createSaida = useCreateSaida();
  const updateSaida = useUpdateSaida();
  const deleteSaida = useDeleteSaida();

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [filtroCentroCusto, setFiltroCentroCusto] = useState<string>("todos");
  const [detalheSaida, setDetalheSaida] = useState<Saida | null>(null);
  const [formData, setFormData] = useState({
    descricao: "",
    valor: "",
    vencimento: format(new Date(), "yyyy-MM-dd"),
    formaPagamento: NENHUMA_FORMA as string,
    dadosPagamento: "",
    status: "pendente" as SaidaInputStatus,
    observacao: "",
    centroCusto: "",
    contaBancaria: "",
    dataPagamento: "",
    recorrente: false,
    diaVencimento: "10",
  });

  const centrosCusto = useMemo(() => {
    const set = new Set<string>();
    saidas.forEach((s) => {
      if (s.centroCusto) set.add(s.centroCusto);
    });
    return Array.from(set).sort();
  }, [saidas]);

  const contasBancarias = useMemo(() => {
    const set = new Set<string>();
    saidas.forEach((s) => {
      if (s.contaBancaria) set.add(s.contaBancaria);
    });
    return Array.from(set).sort();
  }, [saidas]);

  const saidasFiltradas = useMemo(() => {
    if (filtroCentroCusto === "todos") return saidas;
    if (filtroCentroCusto === SEM_CENTRO) return saidas.filter((s) => !s.centroCusto);
    return saidas.filter((s) => s.centroCusto === filtroCentroCusto);
  }, [saidas, filtroCentroCusto]);

  const toggleStatus = (saida: Saida) => {
    const newStatus = saida.status === "pago" ? "pendente" : "pago";
    updateSaida.mutate(
      { id: saida.id, data: { status: newStatus } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListSaidasQueryKey() });
          toast({ title: "Status atualizado!" });
        }
      }
    );
  };

  const handleDelete = (id: number) => {
    if (window.confirm("Tem certeza que deseja excluir esta saída?")) {
      deleteSaida.mutate(
        { id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListSaidasQueryKey() });
            toast({ title: "Saída excluída com sucesso." });
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
    const dataToSend: any = {
      descricao: formData.descricao,
      status: formData.status,
      formaPagamento: formData.formaPagamento === NENHUMA_FORMA ? undefined : formData.formaPagamento as SaidaInputFormaPagamento,
      dadosPagamento: formData.dadosPagamento || undefined,
      centroCusto: formData.centroCusto || undefined,
      contaBancaria: formData.contaBancaria || undefined,
      dataPagamento: formData.dataPagamento || undefined,
      observacao: formData.observacao || undefined,
      recorrente: formData.recorrente,
    };

    if (formData.recorrente) {
      dataToSend.diaVencimento = Number(formData.diaVencimento);
      dataToSend.valor = formData.valor ? Number(formData.valor) : 0;
    } else {
      dataToSend.vencimento = formData.vencimento;
      dataToSend.valor = Number(formData.valor);
    }

    createSaida.mutate(
      { data: dataToSend },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListSaidasQueryKey() });
          toast({ title: "Saída criada com sucesso!" });
          setIsSheetOpen(false);
          setFormData({
            descricao: "", valor: "", vencimento: format(new Date(), "yyyy-MM-dd"),
            formaPagamento: NENHUMA_FORMA, dadosPagamento: "",
            status: "pendente", observacao: "", centroCusto: "", contaBancaria: "", dataPagamento: "",
            recorrente: false, diaVencimento: "10",
          });
        }
      }
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-serif font-bold text-primary">Contas a Pagar</h1>
        
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetTrigger asChild>
            <Button className="bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-md">
              <Plus className="mr-2 h-4 w-4" /> Nova Saída
            </Button>
          </SheetTrigger>
          <SheetContent className="overflow-y-auto w-full sm:max-w-md bg-background border-l border-border">
            <SheetHeader className="mb-6">
              <SheetTitle className="font-serif text-2xl text-destructive">Nova Saída</SheetTitle>
              <SheetDescription>Registre um novo valor a pagar.</SheetDescription>
            </SheetHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição / Fornecedor *</Label>
                <Input id="descricao" required value={formData.descricao} onChange={e => setFormData({...formData, descricao: e.target.value})} className="bg-white" />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border bg-white p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="recorrente" className="flex items-center gap-2">
                    <Repeat className="h-4 w-4" /> Conta recorrente (todo mês)
                  </Label>
                  <p className="text-xs text-muted-foreground">Ex: água, luz, internet — mesmo sem saber o valor ainda.</p>
                </div>
                <Switch id="recorrente" checked={formData.recorrente} onCheckedChange={(v) => setFormData({...formData, recorrente: v})} />
              </div>

              {formData.recorrente ? (
                <div className="space-y-2">
                  <Label htmlFor="diaVencimento">Todo dia do mês *</Label>
                  <Select value={formData.diaVencimento} onValueChange={(v) => setFormData({...formData, diaVencimento: v})}>
                    <SelectTrigger className="bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                        <SelectItem key={d} value={String(d)}>Dia {d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="vencimento">Data de Vencimento *</Label>
                  <Input id="vencimento" type="date" required={!formData.recorrente} value={formData.vencimento} onChange={e => setFormData({...formData, vencimento: e.target.value})} className="bg-white" />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="valor">Valor (R$) {formData.recorrente ? "— deixe em branco se ainda não souber" : "*"}</Label>
                <Input id="valor" type="number" step="0.01" min="0" required={!formData.recorrente} value={formData.valor} onChange={e => setFormData({...formData, valor: e.target.value})} className="bg-white" placeholder={formData.recorrente ? "A definir" : ""} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="formaPagamento">Forma de Pagamento</Label>
                <Select value={formData.formaPagamento} onValueChange={(v) => setFormData({...formData, formaPagamento: v})}>
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NENHUMA_FORMA}>Não informado</SelectItem>
                    <SelectItem value="pix">Pix</SelectItem>
                    <SelectItem value="boleto">Boleto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dadosPagamento">Dados de Pagamento (Chave Pix ou Código de Barras/Link do Boleto)</Label>
                <Input id="dadosPagamento" value={formData.dadosPagamento} onChange={e => setFormData({...formData, dadosPagamento: e.target.value})} className="bg-white" />
              </div>
              {!formData.recorrente && (
                <div className="space-y-2">
                  <Label htmlFor="status">Status *</Label>
                  <Select value={formData.status} onValueChange={(v) => setFormData({...formData, status: v as SaidaInputStatus})}>
                    <SelectTrigger className="bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="pago">Pago</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="centroCusto">Centro de Custo</Label>
                <Input id="centroCusto" placeholder="Ex: Baruch Máquinas, Prima, Lavanderia..." value={formData.centroCusto} onChange={e => setFormData({...formData, centroCusto: e.target.value})} className="bg-white" list="centros-custo-sugestoes-saidas" />
                <datalist id="centros-custo-sugestoes-saidas">
                  {centrosCusto.map((c) => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contaBancaria">Conta Bancária</Label>
                  <Input id="contaBancaria" placeholder="Ex: Inter, Nubank..." value={formData.contaBancaria} onChange={e => setFormData({...formData, contaBancaria: e.target.value})} className="bg-white" list="contas-bancarias-sugestoes-saidas" />
                  <datalist id="contas-bancarias-sugestoes-saidas">
                    {contasBancarias.map((c) => <option key={c} value={c} />)}
                  </datalist>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dataPagamento">Data que Pagou</Label>
                  <Input id="dataPagamento" type="date" value={formData.dataPagamento} onChange={e => setFormData({...formData, dataPagamento: e.target.value})} className="bg-white" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="observacao">Observação</Label>
                <Textarea id="observacao" value={formData.observacao} onChange={e => setFormData({...formData, observacao: e.target.value})} className="bg-white" />
              </div>
              <Button type="submit" className="w-full mt-6 bg-destructive hover:bg-destructive/90 text-destructive-foreground" disabled={createSaida.isPending}>
                {createSaida.isPending ? "Salvando..." : "Salvar Saída"}
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
      ) : saidasFiltradas.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-border shadow-sm">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-serif text-primary">Nenhuma saída registrada</h3>
          <p className="text-muted-foreground">Clique em "Nova Saída" para começar.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {saidasFiltradas.map((saida) => {
            const isPago = saida.status === "pago";
            return (
              <div key={saida.id} className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 rounded-xl border shadow-sm transition-all bg-white hover:border-destructive/30 cursor-pointer ${isPago ? 'border-border opacity-80' : 'border-card-border'}`} onClick={() => setDetalheSaida(saida)}>
                <div className="flex items-start gap-4">
                  <button onClick={(ev) => { ev.stopPropagation(); toggleStatus(saida); }} className={`mt-1 sm:mt-0 flex-shrink-0 transition-colors ${isPago ? 'text-green-500 hover:text-green-600' : 'text-muted-foreground hover:text-destructive'}`}>
                    {isPago ? <CheckCircle2 className="h-6 w-6" /> : <Circle className="h-6 w-6" />}
                  </button>
                  <div className="space-y-1">
                    <p className={`font-bold text-lg sm:text-xl transition-colors ${isPago ? 'text-muted-foreground line-through decoration-muted-foreground/30' : 'text-primary'}`}>
                      {saida.descricao}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className={`font-medium ${isPago ? 'text-muted-foreground' : 'text-destructive'}`}>
                        {saida.recorrente && !saida.valor ? "Valor a definir" : formatCurrency(saida.valor)}
                      </span>
                      <span className="text-muted-foreground">
                        • {saida.recorrente ? `Todo dia ${saida.diaVencimento}` : saida.vencimento ? formatDate(saida.vencimento) : "sem data"}
                      </span>
                      {saida.recorrente && (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] tracking-wider flex items-center gap-1">
                          <Repeat className="h-3 w-3" /> Recorrente
                        </Badge>
                      )}
                      {saida.formaPagamento && (
                        <Badge variant="outline" className="bg-slate-50 uppercase text-[10px] tracking-wider font-semibold">
                          {saida.formaPagamento}
                        </Badge>
                      )}
                      {saida.centroCusto && (
                        <Badge variant="outline" className="bg-destructive/5 text-destructive border-destructive/20 text-[10px] tracking-wider">
                          {saida.centroCusto}
                        </Badge>
                      )}
                      {!saida.recorrente && (
                        <Badge variant={isPago ? "default" : "secondary"} className={isPago ? "bg-green-100 text-green-700 hover:bg-green-100 uppercase text-[10px] tracking-wider" : "uppercase text-[10px] tracking-wider"}>
                          {saida.status}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 sm:mt-0 flex items-center justify-end gap-2">
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={(ev) => { ev.stopPropagation(); setDetalheSaida(saida); }}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={(ev) => { ev.stopPropagation(); handleDelete(saida.id); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!detalheSaida} onOpenChange={(open) => !open && setDetalheSaida(null)}>
        <DialogContent className="bg-background">
          {detalheSaida && (
            <>
              <DialogHeader>
                <DialogTitle className="font-serif text-destructive">{detalheSaida.descricao}</DialogTitle>
                <DialogDescription>Detalhes da saída</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 pt-2">
                {detalheSaida.recorrente ? (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground text-sm">Recorrência</span>
                    <span>Todo dia {detalheSaida.diaVencimento}</span>
                  </div>
                ) : (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground text-sm">Vencimento</span>
                    <span>{detalheSaida.vencimento ? formatDate(detalheSaida.vencimento) : "-"}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">Valor</span>
                  <span className="font-bold text-destructive">
                    {detalheSaida.recorrente && !detalheSaida.valor ? "A definir" : formatCurrency(detalheSaida.valor)}
                  </span>
                </div>
                {detalheSaida.dataPagamento && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground text-sm">Pago em</span>
                    <span>{formatDate(detalheSaida.dataPagamento)}</span>
                  </div>
                )}
                {detalheSaida.contaBancaria && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground text-sm">Conta Bancária</span>
                    <span>{detalheSaida.contaBancaria}</span>
                  </div>
                )}
                {detalheSaida.centroCusto && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground text-sm">Centro de Custo</span>
                    <span>{detalheSaida.centroCusto}</span>
                  </div>
                )}
                {detalheSaida.observacao && (
                  <div className="pt-2 border-t border-border">
                    <span className="text-muted-foreground text-sm">Observação</span>
                    <p className="text-sm mt-1">{detalheSaida.observacao}</p>
                  </div>
                )}
                {detalheSaida.dadosPagamento && (
                  <div className="pt-3 border-t border-border">
                    <Label className="text-sm text-muted-foreground mb-1 block">
                      {detalheSaida.formaPagamento === "pix" ? "Chave Pix" : "Código de Barras / Link do Boleto"}
                    </Label>
                    <div className="flex gap-2">
                      <Input readOnly value={detalheSaida.dadosPagamento} className="bg-slate-50 text-sm" />
                      <Button type="button" variant="outline" size="icon" onClick={() => handleCopy(detalheSaida.dadosPagamento!)}>
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
