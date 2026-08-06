import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, entradasTable, saidasTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

function getDateString(offsetDays: number): string {
  const now = new Date();
  now.setDate(now.getDate() + offsetDays);
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function proximaOcorrencia(diaVencimento: number, referencia: Date): string {
  const year = referencia.getFullYear();
  const month = referencia.getMonth();
  const day = referencia.getDate();

  const diasNoMesAtual = new Date(year, month + 1, 0).getDate();
  const diaAjustadoAtual = Math.min(diaVencimento, diasNoMesAtual);

  let targetYear = year;
  let targetMonth = month;

  if (diaAjustadoAtual < day) {
    targetMonth += 1;
    if (targetMonth > 11) {
      targetMonth = 0;
      targetYear += 1;
    }
  }

  const diasNoMesAlvo = new Date(targetYear, targetMonth + 1, 0).getDate();
  const diaFinal = Math.min(diaVencimento, diasNoMesAlvo);

  return `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-${String(diaFinal).padStart(2, "0")}`;
}

router.get("/avisos", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const today = getDateString(0);
  const tomorrow = getDateString(1);
  const hoje = new Date();

  const [entradas, saidas] = await Promise.all([
    db.select().from(entradasTable).where(eq(entradasTable.userId, userId)),
    db.select().from(saidasTable).where(eq(saidasTable.userId, userId)),
  ]);

  const entradasVencendoAmanha = entradas
    .filter(e => e.vencimento === tomorrow && e.status === "pendente")
    .map(e => ({
      id: e.id,
      cliente: e.cliente,
      valor: parseFloat(e.valor),
      vencimento: e.vencimento,
      formaPagamento: e.formaPagamento,
      dadosPagamento: e.dadosPagamento ?? null,
    }));

  const saidasComuns = saidas.filter(s => !s.recorrente);
  const saidasRecorrentes = saidas.filter(s => s.recorrente && s.diaVencimento);

  const saidasVencendoHoje = saidasComuns
    .filter(s => s.vencimento === today && s.status === "pendente")
    .map(s => ({
      id: s.id,
      descricao: s.descricao,
      valor: parseFloat(s.valor),
      vencimento: s.vencimento as string,
      recorrente: false,
    }));

  const saidasVencendoAmanha = saidasComuns
    .filter(s => s.vencimento === tomorrow && s.status === "pendente")
    .map(s => ({
      id: s.id,
      descricao: s.descricao,
      valor: parseFloat(s.valor),
      vencimento: s.vencimento as string,
      recorrente: false,
    }));

  for (const s of saidasRecorrentes) {
    const proxima = proximaOcorrencia(s.diaVencimento as number, hoje);
    const item = {
      id: s.id,
      descricao: s.descricao,
      valor: parseFloat(s.valor),
      vencimento: proxima,
      recorrente: true,
    };
    if (proxima === today) saidasVencendoHoje.push(item);
    if (proxima === tomorrow) saidasVencendoAmanha.push(item);
  }

  res.json({
    entradasVencendoAmanha,
    saidasVencendoHoje,
    saidasVencendoAmanha,
  });
});

export default router;
