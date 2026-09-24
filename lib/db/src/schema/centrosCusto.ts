import { pgTable, serial, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const centrosCustoTable = pgTable("centros_custo", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  nome: text("nome").notNull(),
  ativo: boolean("ativo").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCentroCustoSchema = createInsertSchema(centrosCustoTable).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCentroCusto = z.infer<typeof insertCentroCustoSchema>;
export type CentroCusto = typeof centrosCustoTable.$inferSelect;

// Assinatura do add-on de centros de custo extras (além dos 2 grátis).
// "quantidade" reflete a quantidade do item de assinatura no Stripe.
export const centrosCustoSubscriptionsTable = pgTable("centros_custo_subscriptions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripeSubscriptionItemId: text("stripe_subscription_item_id"),
  quantidade: integer("quantidade").notNull().default(0),
  status: text("status").notNull().default("none").$type<"none" | "trialing" | "active" | "past_due" | "canceled">(),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type CentrosCustoSubscription = typeof centrosCustoSubscriptionsTable.$inferSelect;
