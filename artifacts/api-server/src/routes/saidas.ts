import { Router, type IRouter } from "express";
import { eq, and, asc } from "drizzle-orm";
import { db, saidasTable } from "@workspace/db";
import {
  CreateSaidaBody,
  UpdateSaidaBody,
  GetSaidaParams,
  UpdateSaidaParams,
  DeleteSaidaParams,
} from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/saidas", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const saidas = await db
    .select()
    .from(saidasTable)
    .where(eq(saidasTable.userId, userId))
    .orderBy(asc(saidasTable.vencimento));

  res.json(saidas.map(s => ({
    ...s,
    valor: parseFloat(s.valor),
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt?.toISOString() ?? null,
  })));
});

router.post("/saidas", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const parsed = CreateSaidaBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [saida] = await db
    .insert(saidasTable)
    .values({ ...parsed.data, userId, valor: String(parsed.data.valor) })
    .returning();

  res.status(201).json({
    ...saida,
    valor: parseFloat(saida.valor),
    createdAt: saida.createdAt.toISOString(),
    updatedAt: saida.updatedAt?.toISOString() ?? null,
  });
});

router.get("/saidas/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const params = GetSaidaParams.safeParse({ id: parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [saida] = await db
    .select()
    .from(saidasTable)
    .where(and(eq(saidasTable.id, params.data.id), eq(saidasTable.userId, userId)));

  if (!saida) {
    res.status(404).json({ error: "Saída não encontrada" });
    return;
  }

  res.json({
    ...saida,
    valor: parseFloat(saida.valor),
    createdAt: saida.createdAt.toISOString(),
    updatedAt: saida.updatedAt?.toISOString() ?? null,
  });
});

router.patch("/saidas/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const params = UpdateSaidaParams.safeParse({ id: parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateSaidaBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (updateData.valor !== undefined) {
    updateData.valor = String(updateData.valor);
  }

  const [saida] = await db
    .update(saidasTable)
    .set(updateData)
    .where(and(eq(saidasTable.id, params.data.id), eq(saidasTable.userId, userId)))
    .returning();

  if (!saida) {
    res.status(404).json({ error: "Saída não encontrada" });
    return;
  }

  res.json({
    ...saida,
    valor: parseFloat(saida.valor),
    createdAt: saida.createdAt.toISOString(),
    updatedAt: saida.updatedAt?.toISOString() ?? null,
  });
});

router.delete("/saidas/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const params = DeleteSaidaParams.safeParse({ id: parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(saidasTable)
    .where(and(eq(saidasTable.id, params.data.id), eq(saidasTable.userId, userId)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Saída não encontrada" });
    return;
  }

  res.sendStatus(204);
});

export default router;
