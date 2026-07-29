import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, subscriptionsTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";
import { stripe } from "../lib/stripe";

const router: IRouter = Router();

const PRICE_MONTHLY = process.env.STRIPE_PRICE_MONTHLY_BRL || "";
const PRICE_ANNUAL = process.env.STRIPE_PRICE_ANNUAL_BRL || "";
const APP_URL = process.env.APP_URL || "";

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

router.post("/billing/checkout", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const period = req.body?.period === "annual" ? "annual" : "monthly";
  const priceId = period === "annual" ? PRICE_ANNUAL : PRICE_MONTHLY;

  if (!priceId) {
    res.status(500).json({ error: "Preço não configurado no servidor" });
    return;
  }

  let [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId));

  let customerId = sub?.stripeCustomerId ?? undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({ metadata: { userId } });
    customerId = customer.id;
  }

  if (!sub) {
    await db.insert(subscriptionsTable).values({ userId, stripeCustomerId: customerId, status: "none" });
  } else if (!sub.stripeCustomerId) {
    await db.update(subscriptionsTable).set({ stripeCustomerId: customerId }).where(eq(subscriptionsTable.userId, userId));
  }

  const jaUsouTrial = Boolean(sub?.trialEnd);

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: jaUsouTrial ? undefined : { trial_period_days: 7 },
    success_url: `${APP_URL}/dashboard?assinatura=sucesso`,
    cancel_url: `${APP_URL}/assinatura?cancelado=1`,
    metadata: { userId },
    locale: "pt-BR",
  });

  res.json({ url: session.url });
});

export default router;
