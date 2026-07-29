import type { Request, Response, NextFunction } from "express";
import { clerkClient } from "@clerk/express";
import { eq } from "drizzle-orm";
import { db, subscriptionsTable } from "@workspace/db";
import type { AuthenticatedRequest } from "./requireAuth";

const MASTER_EMAILS = (process.env.MASTER_USER_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export const requireSubscription = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;

  if (MASTER_EMAILS.length > 0) {
    try {
      const user = await clerkClient.users.getUser(userId);
      const email = user.primaryEmailAddress?.emailAddress?.toLowerCase();
      if (email && MASTER_EMAILS.includes(email)) {
        next();
        return;
      }
    } catch {
      // segue para checagem normal de assinatura
    }
  }

  const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId));

  const now = new Date();
  const isTrialing = sub?.status === "trialing" && sub.trialEnd && sub.trialEnd > now;
  const isActive = sub?.status === "active" && sub.currentPeriodEnd && sub.currentPeriodEnd > now;

  if (isTrialing || isActive) {
    next();
    return;
  }

  res.status(402).json({ error: "Assinatura necessária", code: "SUBSCRIPTION_REQUIRED" });
};
