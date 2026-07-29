import { pgTable, serial, text, numeric, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const entradasTable = pgTable("entradas", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  cliente: text("cliente").notNull(),
  valor: numeric("valor", { precision: 12, scale: 2 }).notNull(),
  vencimento: date("vencimento", { mode: "string" }).notNull(),
  formaPagamento: text("forma_pagamento").notNull().$type<"pix" | "boleto">(),
  dadosPagamento: text("dados_pagamento"),
  status: text("status").notNull().default("pendente").$type<"pago" | "pendente">(),
  observacao: text("observacao"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertEntradaSchema = createInsertSchema(entradasTable).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertEntrada = z.infer<typeof insertEntradaSchema>;
export type Entrada = typeof entradasTable.$inferSelect;
