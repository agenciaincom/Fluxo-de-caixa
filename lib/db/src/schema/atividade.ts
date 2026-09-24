import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Um registro por usuário por dia (id = "<userId>_<data>", evita duplicidade sem precisar de índice composto).
export const atividadeDiariaTable = pgTable("atividade_diaria", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  data: text("data").notNull(), // formato YYYY-MM-DD
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AtividadeDiaria = typeof atividadeDiariaTable.$inferSelect;
