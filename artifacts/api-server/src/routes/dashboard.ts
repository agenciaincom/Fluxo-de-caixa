import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, entradasTable, saidasTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/dashboard", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;

  const [entradas, saidas] = await Promise.all([
    db.select().from(entradasTable).where(eq(entradasTable.userId, userId)),
    db.select().from(saidasTable).where(eq(saidasTable.userId, userId)),
  ]);

  const entradasPagas = entradas
    .filter(e => e.status === "pago")
    .reduce((acc, e) => acc + parseFloat(e.valor), 0);

  const saidasPagas = saidas
    .filter(s => s.status === "pago")
    .reduce((acc, s) => acc + parseFloat(s.valor), 0);

  const entradasPendentes = entradas
    .filter(e => e.status === "pendente")
    .reduce((acc, e) => acc + parseFloat(e.valor), 0);

  const saidasPendentes = saidas
    .filter(s => s.status === "pendente")
    .reduce((acc, s) => acc + parseFloat(s.valor), 0);

  res.json({
    saldoAtual: entradasPagas - saidasPagas,
    totalAReceber: entradasPendentes,
    totalAPagar: saidasPendentes,
    entradasPagas,
    saidasPagas,
    entradasPendentes,
    saidasPendentes,
  });
});

export default router;
