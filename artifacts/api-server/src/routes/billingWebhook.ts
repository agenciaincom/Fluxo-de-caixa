import { Router, type IRouter } from "express";
import express from "express";
import { eq } from "drizzle-orm";
import { db, subscriptionsTable } from "@workspace/db";
import { stripe } from "../lib/stripe";
import { logger } from "../lib/logger";

const router: IRouter = Router();

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
      if (userId) {
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
        await db
          .update(subscriptionsTable)
          .set({
            stripeSubscriptionId: subscription.id,
            status: subscription.status === "trialing" ? "trialing" : "active",
            trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
            currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
          })
          .where(eq(subscriptionsTable.userId, userId));
      }
    }

    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as any;
      const customerId = subscription.customer as string;
      const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.stripeCustomerId, customerId));
      if (sub) {
        const status =
          event.type === "customer.subscription.deleted"
            ? "canceled"
            : subscription.status === "trialing"
              ? "trialing"
              : subscription.status === "active"
                ? "active"
                : "past_due";
        await db
          .update(subscriptionsTable)
          .set({
            status,
            trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
            currentPeriodEnd: subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null,
          })
          .where(eq(subscriptionsTable.userId, sub.userId));
      }
    }
  } catch (err) {
    logger.error({ err }, "Erro ao processar webhook Stripe");
  }

  res.json({ received: true });
});

export default router;
