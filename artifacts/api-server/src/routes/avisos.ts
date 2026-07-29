import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, entradasTable, saidasTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTomorrowString(): string {
  const now = new Date();
  now.setDate(now.getDate() + 1);
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

router.get("/avisos", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const today = getTodayString();
  const tomorrow = getTomorrowString();

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

  const saidasVencendoHoje = saidas
    .filter(s => s.vencimento === today && s.status === "pendente")
    .map(s => ({
      id: s.id,
      descricao: s.descricao,
      valor: parseFloat(s.valor),
      vencimento: s.vencimento,
    }));

  const saidasVencendoAmanha = saidas
    .filter(s => s.vencimento === tomorrow && s.status === "pendente")
    .map(s => ({
      id: s.id,
      descricao: s.descricao,
      valor: parseFloat(s.valor),
      vencimento: s.vencimento,
    }));

  res.json({
    entradasVencendoAmanha,
    saidasVencendoHoje,
    saidasVencendoAmanha,
  });
});

export default router;
