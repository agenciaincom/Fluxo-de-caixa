import { eq } from "drizzle-orm";
import { clerkClient } from "@clerk/express";
import { db, centrosCustoSubscriptionsTable } from "@workspace/db";

const MASTER_EMAILS = (process.env.MASTER_USER_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export const LIMITE_GRATIS = 2;

export interface PlanoCentrosCusto {
  isMaster: boolean;
  extrasComprados: number;
  limite: number | null; // null = ilimitado (conta master)
}

// Lê o filtro "?centros=1,2,3" das rotas de listagem/relatório.
// Retorna null quando não há filtro (mostra tudo, comportamento padrão).
export function parseCentrosFiltro(centrosParam: unknown): number[] | null {
  if (typeof centrosParam !== "string" || !centrosParam.trim() || centrosParam === "todos") return null;
  const ids = centrosParam
    .split(",")
    .map((v) => parseInt(v.trim(), 10))
    .filter((v) => !Number.isNaN(v));
  return ids.length > 0 ? ids : null;
}

export async function getPlanoCentrosCusto(userId: string): Promise<PlanoCentrosCusto> {
  if (MASTER_EMAILS.length > 0) {
    try {
      const user = await clerkClient.users.getUser(userId);
      const email = user.primaryEmailAddress?.emailAddress?.toLowerCase();
      if (email && MASTER_EMAILS.includes(email)) {
        return { isMaster: true, extrasComprados: 0, limite: null };
      }
    } catch {
      // segue para checagem normal
    }
  }

  const [sub] = await db
    .select()
    .from(centrosCustoSubscriptionsTable)
    .where(eq(centrosCustoSubscriptionsTable.userId, userId));

  const now = new Date();
  const assinaturaAtiva = Boolean(
    sub && (sub.status === "active" || sub.status === "trialing") && (!sub.currentPeriodEnd || sub.currentPeriodEnd > now)
  );

  const extrasComprados = assinaturaAtiva ? sub!.quantidade : 0;

  return { isMaster: false, extrasComprados, limite: LIMITE_GRATIS + extrasComprados };
}
