import { Router, type IRouter } from "express";
import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { db, entradasTable, saidasTable, lembretesConfigTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

async function getOrCreateConfig(userId: string) {
  let [config] = await db.select().from(lembretesConfigTable).where(eq(lembretesConfigTable.userId, userId));
  if (!config) {
    const token = randomBytes(24).toString("hex");
    [config] = await db.insert(lembretesConfigTable).values({ userId, token }).returning();
  }
  return config;
}

router.get("/lembretes/config", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const config = await getOrCreateConfig(userId);
  const appUrl = process.env.APP_URL || "";
  res.json({
    incluirPendentes: config.incluirPendentes,
    incluirVencendoSemana: config.incluirVencendoSemana,
    incluirProvisoes: config.incluirProvisoes,
    urlCalendario: `${appUrl}/api/lembretes/calendario/${config.token}.ics`,
  });
});

router.put("/lembretes/config", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  await getOrCreateConfig(userId);

  const { incluirPendentes, incluirVencendoSemana, incluirProvisoes } = req.body;

  await db
    .update(lembretesConfigTable)
    .set({
      incluirPendentes: Boolean(incluirPendentes),
      incluirVencendoSemana: Boolean(incluirVencendoSemana),
      incluirProvisoes: Boolean(incluirProvisoes),
    })
    .where(eq(lembretesConfigTable.userId, userId));

  res.json({ ok: true });
});

function icsDate(dateStr: string): string {
  return dateStr.replace(/-/g, "") + "T090000";
}

function icsEscape(text: string): string {
  return text.replace(/[\\,;]/g, (m) => "\\" + m).replace(/\n/g, "\\n");
}

function diaOcorreNesseMes(diaVencimento: number, referencia: Date): boolean {
  const diasNoMes = new Date(referencia.getFullYear(), referencia.getMonth() + 1, 0).getDate();
  return Math.min(diaVencimento, diasNoMes) === referencia.getDate();
}

function formatDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Rota pública (sem login) — apps de calendário/lembretes acessam direto pelo token
router.get("/lembretes/calendario/:token.ics", async (req, res): Promise<void> => {
  const { token } = req.params;

  const [config] = await db.select().from(lembretesConfigTable).where(eq(lembretesConfigTable.token, token));
  if (!config) {
    res.status(404).send("Calendário não encontrado.");
    return;
  }

  const userId = config.userId;

  const [entradas, saidas] = await Promise.all([
    db.select().from(entradasTable).where(eq(entradasTable.userId, userId)),
    db.select().from(saidasTable).where(eq(saidasTable.userId, userId)),
  ]);

  const hoje = new Date();
  const daqui7dias = new Date(hoje);
  daqui7dias.setDate(daqui7dias.getDate() + 7);
  const hojeStr = formatDateStr(hoje);
  const em7Str = formatDateStr(daqui7dias);

  const eventos: Array<{ uid: string; titulo: string; data: string; descricao: string }> = [];

  if (config.incluirPendentes) {
    entradas
      .filter((e) => e.status === "pendente")
      .forEach((e) => eventos.push({ uid: `entrada-pendente-${e.id}`, titulo: `A receber: ${e.cliente}`, data: e.vencimento, descricao: `Valor: R$ ${e.valor}` }));

    saidas
      .filter((s) => !s.recorrente && s.status === "pendente" && s.vencimento)
      .forEach((s) => eventos.push({ uid: `saida-pendente-${s.id}`, titulo: `A pagar: ${s.descricao}`, data: s.vencimento as string, descricao: `Valor: R$ ${s.valor}` }));
  }

  if (config.incluirVencendoSemana) {
    entradas
      .filter((e) => e.status === "pendente" && e.vencimento >= hojeStr && e.vencimento <= em7Str)
      .forEach((e) => eventos.push({ uid: `entrada-semana-${e.id}`, titulo: `⚠️ Vence essa semana: ${e.cliente}`, data: e.vencimento, descricao: `Valor: R$ ${e.valor}` }));

    saidas
      .filter((s) => !s.recorrente && s.status === "pendente" && s.vencimento && s.vencimento >= hojeStr && s.vencimento <= em7Str)
      .forEach((s) => eventos.push({ uid: `saida-semana-${s.id}`, titulo: `⚠️ Vence essa semana: ${s.descricao}`, data: s.vencimento as string, descricao: `Valor: R$ ${s.valor}` }));
  }

  if (config.incluirProvisoes) {
    const saidasRecorrentes = saidas.filter((s) => s.recorrente && s.diaVencimento);
    for (let i = 0; i <= 7; i++) {
      const dataRef = new Date(hoje);
      dataRef.setDate(dataRef.getDate() + i);
      for (const s of saidasRecorrentes) {
        if (!diaOcorreNesseMes(s.diaVencimento as number, dataRef)) continue;
        if (s.recorrenciaVezes) {
          const criada = new Date(s.createdAt);
          const meses = (dataRef.getFullYear() - criada.getFullYear()) * 12 + (dataRef.getMonth() - criada.getMonth());
          if (meses >= s.recorrenciaVezes) continue;
        }
        eventos.push({
          uid: `provisao-${s.id}-${formatDateStr(dataRef)}`,
          titulo: `📋 Provisão: ${s.descricao}`,
          data: formatDateStr(dataRef),
          descricao: parseFloat(s.valor || "0") > 0 ? `Valor estimado: R$ ${s.valor}` : "Valor ainda a definir",
        });
      }
    }
  }

  const now = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const vevents = eventos
    .map(
      (ev) => `BEGIN:VEVENT
UID:${ev.uid}@fluxo-de-caixa
DTSTAMP:${now}
DTSTART:${icsDate(ev.data)}
SUMMARY:${icsEscape(ev.titulo)}
DESCRIPTION:${icsEscape(ev.descricao)}
BEGIN:VALARM
TRIGGER:-PT9H
ACTION:DISPLAY
DESCRIPTION:${icsEscape(ev.titulo)}
END:VALARM
END:VEVENT`
    )
    .join("\n");

  const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Fluxo de Caixa//Lembretes//PT
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:Fluxo de Caixa - Lembretes
REFRESH-INTERVAL;VALUE=DURATION:PT6H
${vevents}
END:VCALENDAR`;

  res.set("Content-Type", "text/calendar; charset=utf-8");
  res.set("Content-Disposition", "inline; filename=lembretes.ics");
  res.send(ics);
});

export default router;
