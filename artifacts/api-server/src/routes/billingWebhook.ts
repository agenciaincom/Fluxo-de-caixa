import { Router, type IRouter } from "express";
import express from "express";
import { eq } from "drizzle-orm";
import { db, subscriptionsTable, conciliacaoSubscriptionsTable, centrosCustoSubscriptionsTable } from "@workspace/db";
import { stripe } from "../lib/stripe";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function getCurrentPeriodEnd(subscription: any): Date | null {
  const fromItem = subscription?.items?.data?.[0]?.current_period_end;
  const fromTop = subscription?.current_period_end;
  const raw = fromItem ?? fromTop;
  if (!raw) return null;
  const date = new Date(raw * 1000);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getTrialEnd(subscription: any): Date | null {
  const raw = subscription?.trial_end;
  if (!raw) return null;
  const date = new Date(raw * 1000);
  return Number.isNaN(date.getTime()) ? null : date;
}

router.post("/", express.raw({ type: "application/json" }), async (req, res): Promise<void> => {
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    res.status(400).send("Missing signature or secret");
    return;
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig as string, webhookSecret);
  } catch (err) {
    logger.error({ err }, "Falha na verificação do webhook Stripe");
    res.status(400).send("Invalid signature");
    return;
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as any;
      const userId = session.metadata?.userId;
      const produto = session.metadata?.produto === "conciliacao"
        ? "conciliacao"
        : session.metadata?.produto === "centro_custo_extra"
          ? "centro_custo_extra"
          : "principal";

      if (userId) {
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);

        if (produto === "centro_custo_extra") {
          const item = subscription.items?.data?.[0];
          await db
            .update(centrosCustoSubscriptionsTable)
            .set({
              stripeSubscriptionId: subscription.id,
              stripeSubscriptionItemId: item?.id,
              quantidade: item?.quantity ?? 1,
              status: subscription.status === "trialing" ? "trialing" : "active",
              currentPeriodEnd: getCurrentPeriodEnd(subscription),
            })
            .where(eq(centrosCustoSubscriptionsTable.userId, userId));
        } else {
          const tabela = produto === "conciliacao" ? conciliacaoSubscriptionsTable : subscriptionsTable;
          await db
            .update(tabela)
            .set({
              stripeSubscriptionId: subscription.id,
              status: subscription.status === "trialing" ? "trialing" : "active",
              trialEnd: getTrialEnd(subscription),
              currentPeriodEnd: getCurrentPeriodEnd(subscription),
            })
            .where(eq(tabela.userId, userId));
        }
      }
    }

    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as any;
      const stripeSubscriptionId = subscription.id as string;

      const [subPrincipal] = await db
        .select()
        .from(subscriptionsTable)
        .where(eq(subscriptionsTable.stripeSubscriptionId, stripeSubscriptionId));
      const [subConciliacao] = subPrincipal
        ? [undefined]
        : await db.select().from(conciliacaoSubscriptionsTable).where(eq(conciliacaoSubscriptionsTable.stripeSubscriptionId, stripeSubscriptionId));
      const [subCentroCusto] = subPrincipal || subConciliacao
        ? [undefined]
        : await db.select().from(centrosCustoSubscriptionsTable).where(eq(centrosCustoSubscriptionsTable.stripeSubscriptionId, stripeSubscriptionId));

      const tabela = subPrincipal ? subscriptionsTable : subConciliacao ? conciliacaoSubscriptionsTable : centrosCustoSubscriptionsTable;
      const registro = subPrincipal ?? subConciliacao ?? subCentroCusto;

      if (registro) {
        const status =
          event.type === "customer.subscription.deleted"
            ? "canceled"
            : subscription.status === "trialing"
              ? "trialing"
              : subscription.status === "active"
                ? "active"
                : "past_due";

        const extra: Record<string, unknown> = {};
        if (tabela === centrosCustoSubscriptionsTable) {
          const item = subscription.items?.data?.[0];
          if (item) {
            extra.quantidade = item.quantity ?? (registro as any).quantidade;
            extra.stripeSubscriptionItemId = item.id;
          }
        } else {
          extra.trialEnd = getTrialEnd(subscription);
        }

        await db
          .update(tabela)
          .set({
            status,
            currentPeriodEnd: subscription.current_period_end || subscription.items?.data?.[0]?.current_period_end ? getCurrentPeriodEnd(subscription) : registro.currentPeriodEnd,
            ...extra,
          } as never)
          .where(eq(tabela.userId, registro.userId));
      }
    }
  } catch (err) {
    logger.error({ err }, "Erro ao processar webhook Stripe");
  }

  res.json({ received: true });
});

export default router;
