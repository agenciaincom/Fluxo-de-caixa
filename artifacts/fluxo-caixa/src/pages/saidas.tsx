import { useState, useMemo } from "react";
import { useListSaidas, useCreateSaida, useUpdateSaida, useDeleteSaida, getListSaidasQueryKey, Saida, SaidaInputStatus } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Trash2, CheckCircle2, Circle, FileText, Tag } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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

export default function SaidasPage() {
  const { data: saidas = [], isLoading } = useListSaidas();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const createSaida = useCreateSaida();
  const updateSaida = useUpdateSaida();
  const deleteSaida = useDeleteSaida();

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [filtroCentroCusto, setFiltroCentroCusto] = useState<string>("todos");
  const [formData, setFormData] = useState({
    descricao: "",
    valor: "",
    vencimento: format(new Date(), "yyyy-MM-dd"),
    status: "pendente" as SaidaInputStatus,
    observacao: "",
    centroCusto: "",
  });

  const centrosCusto = useMemo(() => {
    const set = new Set<string>();
    saidas.forEach((s) => {
      if (s.centroCusto) set.add(s.centroCusto);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createSaida.mutate(
      { 
        data: {
          ...formData,
          valor: Number(formData.valor),
          centroCusto: formData.centroCusto || undefined,
        } 
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListSaidasQueryKey() });
          toast({ title: "Saída criada com sucesso!" });
          setIsSheetOpen(false);
          setFormData({
            descricao: "", valor: "", vencimento: format(new Date(), "yyyy-MM-dd"),
            status: "pendente", observacao: "", centroCusto: ""
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
              <div className="space-y-2">
                <Label htmlFor="valor">Valor (R$) *</Label>
                <Input id="valor" type="number" step="0.01" min="0.01" required value={formData.valor} onChange={e => setFormData({...formData, valor: e.target.value})} className="bg-white" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vencimento">Data de Vencimento *</Label>
                <Input id="vencimento" type="date" required value={formData.vencimento} onChange={e => setFormData({...formData, vencimento: e.target.value})} className="bg-white" />
              </div>
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
              <div className="space-y-2">
                <Label htmlFor="centroCusto">Centro de Custo</Label>
                <Input id="centroCusto" placeholder="Ex: Baruch Máquinas, Prima, Lavanderia..." value={formData.centroCusto} onChange={e => setFormData({...formData, centroCusto: e.target.value})} className="bg-white" list="centros-custo-sugestoes-saidas" />
                <datalist id="centros-custo-sugestoes-saidas">
                  {centrosCusto.map((c) => <option key={c} value={c} />)}
                </datalist>
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
              <div key={saida.id} className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 rounded-xl border shadow-sm transition-all bg-white hover:border-destructive/30 ${isPago ? 'border-border opacity-80' : 'border-card-border'}`}>
                <div className="flex items-start gap-4">
                  <button onClick={() => toggleStatus(saida)} className={`mt-1 sm:mt-0 flex-shrink-0 transition-colors ${isPago ? 'text-green-500 hover:text-green-600' : 'text-muted-foreground hover:text-destructive'}`}>
                    {isPago ? <CheckCircle2 className="h-6 w-6" /> : <Circle className="h-6 w-6" />}
                  </button>
                  <div className="space-y-1">
                    <p className={`font-bold text-lg sm:text-xl transition-colors ${isPago ? 'text-muted-foreground line-through decoration-muted-foreground/30' : 'text-primary'}`}>
                      {saida.descricao}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className={`font-medium ${isPago ? 'text-muted-foreground' : 'text-destructive'}`}>
                        {formatCurrency(saida.valor)}
                      </span>
                      <span className="text-muted-foreground">• {formatDate(saida.vencimento)}</span>
                      {saida.centroCusto && (
                        <Badge variant="outline" className="bg-destructive/5 text-destructive border-destructive/20 text-[10px] tracking-wider ml-2">
                          {saida.centroCusto}
                        </Badge>
                      )}
                      <Badge variant={isPago ? "default" : "secondary"} className={isPago ? "bg-green-100 text-green-700 hover:bg-green-100 uppercase text-[10px] tracking-wider ml-2" : "uppercase text-[10px] tracking-wider ml-2"}>
                        {saida.status}
                      </Badge>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 sm:mt-0 flex items-center justify-end gap-2">
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(saida.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
