import type { Request, Response, NextFunction } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { eq } from "drizzle-orm";
import { db, conciliacaoSubscriptionsTable } from "@workspace/db";

const MASTER_EMAILS = (process.env.MASTER_USER_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export const requireConciliacao = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;

  if (!userId) {
    res.status(401).json({ error: "Não autorizado" });
    return;
  }

  if (MASTER_EMAILS.length > 0) {
    try {
      const user = await clerkClient.users.getUser(userId);
      const email = user.primaryEmailAddress?.emailAddress?.toLowerCase();
      if (email && MASTER_EMAILS.includes(email)) {
        next();
        return;
      }
    } catch {
      // segue para checagem normal
    }
  }

  const [sub] = await db
    .select()
    .from(conciliacaoSubscriptionsTable)
    .where(eq(conciliacaoSubscriptionsTable.userId, userId));

  const now = new Date();
  const isTrialing = sub?.status === "trialing" && sub.trialEnd && sub.trialEnd > now;
  const isActive = sub?.status === "active" && sub.currentPeriodEnd && sub.currentPeriodEnd > now;

  if (isTrialing || isActive) {
    next();
    return;
  }

  res.status(402).json({ error: "Assinatura de Conciliação necessária", code: "CONCILIACAO_REQUIRED" });
};
