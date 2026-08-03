import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, subscriptionsTable, conciliacaoSubscriptionsTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";
import { stripe } from "../lib/stripe";

const router: IRouter = Router();

const PRICE_MONTHLY = process.env.STRIPE_PRICE_MONTHLY_BRL || "";
const PRICE_ANNUAL = process.env.STRIPE_PRICE_ANNUAL_BRL || "";
const PRICE_CONCILIACAO_AVULSA = process.env.STRIPE_PRICE_CONCILIACAO_AVULSA_BRL || "";
const PRICE_CONCILIACAO_PACOTE = process.env.STRIPE_PRICE_CONCILIACAO_PACOTE_BRL || "";
const APP_URL = process.env.APP_URL || "";

async function getOrCreateCustomer(userId: string): Promise<string> {
  const [subPrincipal] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId));
  if (subPrincipal?.stripeCustomerId) return subPrincipal.stripeCustomerId;

  const [subConciliacao] = await db.select().from(conciliacaoSubscriptionsTable).where(eq(conciliacaoSubscriptionsTable.userId, userId));
  if (subConciliacao?.stripeCustomerId) return subConciliacao.stripeCustomerId;

  const customer = await stripe.customers.create({ metadata: { userId } });
  return customer.id;
}

router.get("/billing/status", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId));

  if (!sub) {
    res.json({ active: false, status: "none" });
    return;
  }

  const now = new Date();
  const isTrialing = sub.status === "trialing" && sub.trialEnd && sub.trialEnd > now;
  const isActive = sub.status === "active" && sub.currentPeriodEnd && sub.currentPeriodEnd > now;

  res.json({
    active: Boolean(isTrialing || isActive),
    status: sub.status,
    trialEnd: sub.trialEnd?.toISOString() ?? null,
    currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
  });
});

router.get("/billing/status-conciliacao", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const [sub] = await db.select().from(conciliacaoSubscriptionsTable).where(eq(conciliacaoSubscriptionsTable.userId, userId));

  const [subPrincipal] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId));
  const now = new Date();
  const principalAtivo = Boolean(
    subPrincipal &&
      ((subPrincipal.status === "trialing" && subPrincipal.trialEnd && subPrincipal.trialEnd > now) ||
        (subPrincipal.status === "active" && subPrincipal.currentPeriodEnd && subPrincipal.currentPeriodEnd > now))
  );

  if (!sub) {
    res.json({ active: false, status: "none", precoPacote: principalAtivo });
    return;
  }

  const isTrialing = sub.status === "trialing" && sub.trialEnd && sub.trialEnd > now;
  const isActive = sub.status === "active" && sub.currentPeriodEnd && sub.currentPeriodEnd > now;

  res.json({
    active: Boolean(isTrialing || isActive),
    status: sub.status,
    trialEnd: sub.trialEnd?.toISOString() ?? null,
    currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
    precoPacote: principalAtivo,
  });
});

router.post("/billing/checkout", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const period = req.body?.period === "annual" ? "annual" : "monthly";
  const priceId = period === "annual" ? PRICE_ANNUAL : PRICE_MONTHLY;

  if (!priceId) {
    res.status(500).json({ error: "Preço não configurado no servidor" });
    return;
  }

  let [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId));

  const customerId = await getOrCreateCustomer(userId);

  if (!sub) {
    await db.insert(subscriptionsTable).values({ userId, stripeCustomerId: customerId, status: "none" });
  } else if (!sub.stripeCustomerId) {
    await db.update(subscriptionsTable).set({ stripeCustomerId: customerId }).where(eq(subscriptionsTable.userId, userId));
  }

  const jaUsouTrial = Boolean(sub?.trialEnd);

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: jaUsouTrial ? undefined : { trial_period_days: 7 },
    success_url: `${APP_URL}/dashboard?assinatura=sucesso`,
    cancel_url: `${APP_URL}/assinatura?cancelado=1`,
    metadata: { userId, produto: "principal" },
    locale: "pt-BR",
  });

  res.json({ url: session.url });
});

router.post("/billing/checkout-conciliacao", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;

  const [subPrincipal] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId));
  const now = new Date();
  const principalAtivo = Boolean(
    subPrincipal &&
      ((subPrincipal.status === "trialing" && subPrincipal.trialEnd && subPrincipal.trialEnd > now) ||
        (subPrincipal.status === "active" && subPrincipal.currentPeriodEnd && subPrincipal.currentPeriodEnd > now))
  );

  const priceId = principalAtivo ? PRICE_CONCILIACAO_PACOTE : PRICE_CONCILIACAO_AVULSA;

  if (!priceId) {
    res.status(500).json({ error: "Preço não configurado no servidor" });
    return;
  }

  let [sub] = await db.select().from(conciliacaoSubscriptionsTable).where(eq(conciliacaoSubscriptionsTable.userId, userId));

  const customerId = await getOrCreateCustomer(userId);

  if (!sub) {
    await db.insert(conciliacaoSubscriptionsTable).values({ userId, stripeCustomerId: customerId, status: "none" });
  } else if (!sub.stripeCustomerId) {
    await db.update(conciliacaoSubscriptionsTable).set({ stripeCustomerId: customerId }).where(eq(conciliacaoSubscriptionsTable.userId, userId));
  }

  const jaUsouTrial = Boolean(sub?.trialEnd);

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: jaUsouTrial ? undefined : { trial_period_days: 7 },
    success_url: `${APP_URL}/conciliacao?assinatura=sucesso`,
    cancel_url: `${APP_URL}/conciliacao?cancelado=1`,
    metadata: { userId, produto: "conciliacao" },
    locale: "pt-BR",
  });

  res.json({ url: session.url });
});

export default router;
