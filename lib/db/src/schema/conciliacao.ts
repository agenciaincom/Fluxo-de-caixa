import { pgTable, serial, text, numeric, date, timestamp, integer } from "drizzle-orm/pg-core";

export const conciliacaoSubscriptionsTable = pgTable("conciliacao_subscriptions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  status: text("status").notNull().default("none").$type<"none" | "trialing" | "active" | "past_due" | "canceled">(),
  trialEnd: timestamp("trial_end", { withTimezone: true }),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const conciliacoesTable = pgTable("conciliacoes", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  tipo: text("tipo").notNull().$type<"comprovante" | "maquininha" | "extrato">(),
  nomeArquivo: text("nome_arquivo"),
  totalItens: integer("total_itens").notNull().default(0),
  totalCorrespondidos: integer("total_correspondidos").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const conciliacaoItensTable = pgTable("conciliacao_itens", {
  id: serial("id").primaryKey(),
  conciliacaoId: integer("conciliacao_id").notNull(),
  userId: text("user_id").notNull(),
  data: date("data", { mode: "string" }),
  valor: numeric("valor", { precision: 12, scale: 2 }).notNull(),
  tipo: text("tipo"),
  descricao: text("descricao"),
  status: text("status").notNull().default("nao_encontrado").$type<"correspondido" | "nao_encontrado">(),
  entradaId: integer("entrada_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ConciliacaoSubscription = typeof conciliacaoSubscriptionsTable.$inferSelect;
export type Conciliacao = typeof conciliacoesTable.$inferSelect;
export type ConciliacaoItem = typeof conciliacaoItensTable.$inferSelect;
