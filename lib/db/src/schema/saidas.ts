import { pgTable, serial, text, numeric, date, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const saidasTable = pgTable("saidas", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  descricao: text("descricao").notNull(),
  valor: numeric("valor", { precision: 12, scale: 2 }).notNull().default("0"),
  vencimento: date("vencimento", { mode: "string" }),
  formaPagamento: text("forma_pagamento").$type<"pix" | "boleto">(),
  dadosPagamento: text("dados_pagamento"),
  status: text("status").notNull().default("pendente").$type<"pago" | "pendente">(),
  observacao: text("observacao"),
  centroCusto: text("centro_custo"),
  contaBancaria: text("conta_bancaria"),
  dataPagamento: date("data_pagamento", { mode: "string" }),
  recorrente: boolean("recorrente").notNull().default(false),
  diaVencimento: integer("dia_vencimento"),
  recorrenciaVezes: integer("recorrencia_vezes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSaidaSchema = createInsertSchema(saidasTable).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSaida = z.infer<typeof insertSaidaSchema>;
export type Saida = typeof saidasTable.$inferSelect;
