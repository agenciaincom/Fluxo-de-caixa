import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, entradasTable, saidasTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

const DIAS_SEMANA_ABREV = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function getStartOfWeek(dateStr?: string): string {
  let date: Date;
  if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    // Parse as local date (avoid UTC offset issues)
    const [year, month, day] = dateStr.split("-").map(Number);
    date = new Date(year, month - 1, day);
  } else {
    date = new Date();
  }
  // Start of week = Monday
  const dayOfWeek = date.getDay(); // 0 = Sunday
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  date.setDate(date.getDate() + diff);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getDayOfWeekLabel(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return DIAS_SEMANA_ABREV[date.getDay()];
}

router.get("/relatorio-semanal", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const weekStartParam = req.query.weekStart as string | undefined;
  const weekStart = getStartOfWeek(weekStartParam);
  const weekEnd = addDays(weekStart, 6);

  const [entradas, saidas] = await Promise.all([
    db.select().from(entradasTable).where(eq(entradasTable.userId, userId)),
    db.select().from(saidasTable).where(eq(saidasTable.userId, userId)),
  ]);

  // Filter to week and only paid entries
  const entradasSemana = entradas.filter(
    e => e.vencimento >= weekStart && e.vencimento <= weekEnd
  );
  const saidasSemana = saidas.filter(
    s => s.vencimento >= weekStart && s.vencimento <= weekEnd
  );

  // Build per-day data
  const diasSemana = [];
  let totalEntradas = 0;
  let totalSaidas = 0;

  for (let i = 0; i < 7; i++) {
    const data = addDays(weekStart, i);
    const entradasDia = entradasSemana
      .filter(e => e.vencimento === data)
      .reduce((acc, e) => acc + parseFloat(e.valor), 0);
    const saidasDia = saidasSemana
      .filter(s => s.vencimento === data)
      .reduce((acc, s) => acc + parseFloat(s.valor), 0);

    totalEntradas += entradasDia;
    totalSaidas += saidasDia;

    diasSemana.push({
      data,
      diaSemana: getDayOfWeekLabel(data),
      entradas: entradasDia,
      saidas: saidasDia,
    });
  }

  res.json({
    weekStart,
    weekEnd,
    totalEntradas,
    totalSaidas,
    saldo: totalEntradas - totalSaidas,
    diasSemana,
  });
});

export default router;
