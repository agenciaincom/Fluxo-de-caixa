import { Router, type IRouter } from "express";
import { eq, and, isNull, isNotNull, ne } from "drizzle-orm";
import {
  db,
  centrosCustoTable,
  centrosCustoSubscriptionsTable,
  entradasTable,
  saidasTable,
} from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";
import { getPlanoCentrosCusto } from "../lib/centrosCustoPlano";
import { stripe } from "../lib/stripe";

const router: IRouter = Router();

const PRICE_CENTRO_CUSTO_EXTRA = process.env.STRIPE_PRICE_CENTRO_CUSTO_EXTRA_BRL || "";
const APP_URL = process.env.APP_URL || "";

// Migra, de forma preguiçosa e idempotente, os valores antigos de "centro de custo"
// (texto livre) para centros de custo de verdade, associando-os aos lançamentos.
async function migrarCentrosLegado(userId: string): Promise<void> {
  const [entradasSemId, saidasSemId] = await Promise.all([
    db
      .select({ centroCusto: entradasTable.centroCusto })
      .from(entradasTable)
      .where(and(eq(entradasTable.userId, userId), isNull(entradasTable.centroCustoId), isNotNull(entradasTable.centroCusto), ne(entradasTable.centroCusto, ""))),
    db
      .select({ centroCusto: saidasTable.centroCusto })
      .from(saidasTable)
      .where(and(eq(saidasTable.userId, userId), isNull(saidasTable.centroCustoId), isNotNull(saidasTable.centroCusto), ne(saidasTable.centroCusto, ""))),
  ]);

  const nomesLegado = Array.from(
    new Set([...entradasSemId, ...saidasSemId].map((r) => (r.centroCusto as string).trim()).filter(Boolean))
  );

  if (nomesLegado.length === 0) return;

  const existentes = await db.select().from(centrosCustoTable).where(eq(centrosCustoTable.userId, userId));
  const existentesPorNome = new Map(existentes.map((c) => [c.nome.trim().toLowerCase(), c]));

  for (const nome of nomesLegado) {
    let centro = existentesPorNome.get(nome.toLowerCase());
    if (!centro) {
      const [criado] = await db.insert(centrosCustoTable).values({ userId, nome }).returning();
      centro = criado;
      existentesPorNome.set(nome.toLowerCase(), centro);
    }

    await db
      .update(entradasTable)
      .set({ centroCustoId: centro.id })
      .where(and(eq(entradasTable.userId, userId), eq(entradasTable.centroCusto, nome), isNull(entradasTable.centroCustoId)));

    await db
      .update(saidasTable)
      .set({ centroCustoId: centro.id })
      .where(and(eq(saidasTable.userId, userId), eq(saidasTable.centroCusto, nome), isNull(saidasTable.centroCustoId)));
  }
}

router.get("/centros-custo", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;

  await migrarCentrosLegado(userId);

  const [centros, plano] = await Promise.all([
    db.select().from(centrosCustoTable).where(eq(centrosCustoTable.userId, userId)).orderBy(centrosCustoTable.nome),
    getPlanoCentrosCusto(userId),
  ]);

  res.json({
    centros,
    isMaster: plano.isMaster,
    limite: plano.limite,
    usados: centros.filter((c) => c.ativo).length,
    extrasComprados: plano.extrasComprados,
  });
});

router.post("/centros-custo", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const nome = typeof req.body?.nome === "string" ? req.body.nome.trim() : "";

  if (!nome) {
    res.status(400).json({ error: "Nome do centro de custo é obrigatório" });
    return;
  }

  const plano = await getPlanoCentrosCusto(userId);

  if (plano.limite !== null) {
    const [centros] = await Promise.all([
      db.select().from(centrosCustoTable).where(and(eq(centrosCustoTable.userId, userId), eq(centrosCustoTable.ativo, true))),
    ]);
    if (centros.length >= plano.limite) {
      res.status(402).json({
        error: "Limite de centros de custo atingido",
        code: "CENTRO_CUSTO_LIMITE",
        limite: plano.limite,
      });
      return;
    }
  }

  const [centro] = await db.insert(centrosCustoTable).values({ userId, nome }).returning();
  res.status(201).json(centro);
});

router.patch("/centros-custo/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Id inválido" });
    return;
  }

  const updateData: { nome?: string; ativo?: boolean } = {};
  if (typeof req.body?.nome === "string" && req.body.nome.trim()) updateData.nome = req.body.nome.trim();
  if (typeof req.body?.ativo === "boolean") updateData.ativo = req.body.ativo;

  const [centro] = await db
    .update(centrosCustoTable)
    .set(updateData)
    .where(and(eq(centrosCustoTable.id, id), eq(centrosCustoTable.userId, userId)))
    .returning();

  if (!centro) {
    res.status(404).json({ error: "Centro de custo não encontrado" });
    return;
  }

  res.json(centro);
});

router.delete("/centros-custo/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Id inválido" });
    return;
  }

  const [emUsoEntrada] = await db.select({ id: entradasTable.id }).from(entradasTable).where(and(eq(entradasTable.centroCustoId, id), eq(entradasTable.userId, userId))).limit(1);
  const [emUsoSaida] = await db.select({ id: saidasTable.id }).from(saidasTable).where(and(eq(saidasTable.centroCustoId, id), eq(saidasTable.userId, userId))).limit(1);

  if (emUsoEntrada || emUsoSaida) {
    const [centro] = await db
      .update(centrosCustoTable)
      .set({ ativo: false })
      .where(and(eq(centrosCustoTable.id, id), eq(centrosCustoTable.userId, userId)))
      .returning();
    if (!centro) {
      res.status(404).json({ error: "Centro de custo não encontrado" });
      return;
    }
    res.json({ ...centro, desativado: true });
    return;
  }

  const [deletado] = await db
    .delete(centrosCustoTable)
    .where(and(eq(centrosCustoTable.id, id), eq(centrosCustoTable.userId, userId)))
    .returning();

  if (!deletado) {
    res.status(404).json({ error: "Centro de custo não encontrado" });
    return;
  }

  res.sendStatus(204);
});

// Compra ou aumenta a quantidade de centros de custo extras (R$19,90/mês cada).
router.post("/centros-custo/upgrade", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;

  if (!PRICE_CENTRO_CUSTO_EXTRA) {
    res.status(500).json({ error: "Preço do centro de custo extra não configurado no servidor" });
    return;
  }

  const [subExistente] = await db
    .select()
    .from(centrosCustoSubscriptionsTable)
    .where(eq(centrosCustoSubscriptionsTable.userId, userId));

  // Já tem assinatura ativa deste add-on: apenas soma mais 1 slot na quantidade (com proração automática do Stripe).
  if (subExistente?.stripeSubscriptionItemId && (subExistente.status === "active" || subExistente.status === "trialing")) {
    const novaQuantidade = subExistente.quantidade + 1;
    const item = await stripe.subscriptionItems.update(subExistente.stripeSubscriptionItemId, {
      quantity: novaQuantidade,
      proration_behavior: "always_invoice",
    });
    await db
      .update(centrosCustoSubscriptionsTable)
      .set({ quantidade: item.quantity ?? novaQuantidade })
      .where(eq(centrosCustoSubscriptionsTable.userId, userId));

    res.json({ quantidade: item.quantity ?? novaQuantidade });
    return;
  }

  // Sem assinatura ativa deste add-on: cria uma nova via Checkout.
  let customerId = subExistente?.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({ metadata: { userId } });
    customerId = customer.id;
  }

  if (!subExistente) {
    await db.insert(centrosCustoSubscriptionsTable).values({ userId, stripeCustomerId: customerId, status: "none" });
  } else if (!subExistente.stripeCustomerId) {
    await db
      .update(centrosCustoSubscriptionsTable)
      .set({ stripeCustomerId: customerId })
      .where(eq(centrosCustoSubscriptionsTable.userId, userId));
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: PRICE_CENTRO_CUSTO_EXTRA, quantity: 1 }],
    success_url: `${APP_URL}/centros-custo?upgrade=sucesso`,
    cancel_url: `${APP_URL}/centros-custo?cancelado=1`,
    metadata: { userId, produto: "centro_custo_extra" },
    locale: "pt-BR",
  });

  res.json({ url: session.url });
});

export default router;
