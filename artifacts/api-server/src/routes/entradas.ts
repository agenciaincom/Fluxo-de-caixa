import { Router, type IRouter } from "express";
import { eq, and, asc } from "drizzle-orm";
import { db, entradasTable } from "@workspace/db";
import {
  CreateEntradaBody,
  UpdateEntradaBody,
  GetEntradaParams,
  UpdateEntradaParams,
  DeleteEntradaParams,
} from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/entradas", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const entradas = await db
    .select()
    .from(entradasTable)
    .where(eq(entradasTable.userId, userId))
    .orderBy(asc(entradasTable.vencimento));

  res.json(entradas.map(e => ({
    ...e,
    valor: parseFloat(e.valor),
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt?.toISOString() ?? null,
  })));
});

router.post("/entradas", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const parsed = CreateEntradaBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [entrada] = await db
    .insert(entradasTable)
    .values({ ...parsed.data, userId, valor: String(parsed.data.valor) })
    .returning();

  res.status(201).json({
    ...entrada,
    valor: parseFloat(entrada.valor),
    createdAt: entrada.createdAt.toISOString(),
    updatedAt: entrada.updatedAt?.toISOString() ?? null,
  });
});

router.get("/entradas/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const params = GetEntradaParams.safeParse({ id: parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [entrada] = await db
    .select()
    .from(entradasTable)
    .where(and(eq(entradasTable.id, params.data.id), eq(entradasTable.userId, userId)));

  if (!entrada) {
    res.status(404).json({ error: "Entrada não encontrada" });
    return;
  }

  res.json({
    ...entrada,
    valor: parseFloat(entrada.valor),
    createdAt: entrada.createdAt.toISOString(),
    updatedAt: entrada.updatedAt?.toISOString() ?? null,
  });
});

router.patch("/entradas/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const params = UpdateEntradaParams.safeParse({ id: parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateEntradaBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (updateData.valor !== undefined) {
    updateData.valor = String(updateData.valor);
  }

  const [entrada] = await db
    .update(entradasTable)
    .set(updateData)
    .where(and(eq(entradasTable.id, params.data.id), eq(entradasTable.userId, userId)))
    .returning();

  if (!entrada) {
    res.status(404).json({ error: "Entrada não encontrada" });
    return;
  }

  res.json({
    ...entrada,
    valor: parseFloat(entrada.valor),
    createdAt: entrada.createdAt.toISOString(),
    updatedAt: entrada.updatedAt?.toISOString() ?? null,
  });
});

router.delete("/entradas/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const params = DeleteEntradaParams.safeParse({ id: parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(entradasTable)
    .where(and(eq(entradasTable.id, params.data.id), eq(entradasTable.userId, userId)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Entrada não encontrada" });
    return;
  }

  res.sendStatus(204);
});

export default router;
