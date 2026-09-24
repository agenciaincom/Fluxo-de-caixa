import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const lembretesConfigTable = pgTable("lembretes_config", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  token: text("token").notNull().unique(),
  incluirPendentes: boolean("incluir_pendentes").notNull().default(true),
  incluirVencendoSemana: boolean("incluir_vencendo_semana").notNull().default(true),
  incluirProvisoes: boolean("incluir_provisoes").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type LembretesConfig = typeof lembretesConfigTable.$inferSelect;
