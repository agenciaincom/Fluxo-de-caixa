import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, atividadeDiariaTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

const MARCOS = [7, 30, 90] as const;

function getDateString(offsetDays = 0): string {
  const now = new Date();
  now.setDate(now.getDate() + offsetDays);
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function registrarAtividadeHoje(userId: string): Promise<void> {
  const hoje = getDateString();
  const id = `${userId}_${hoje}`;
  await db
    .insert(atividadeDiariaTable)
    .values({ id, userId, data: hoje })
    .onConflictDoNothing({ target: atividadeDiariaTable.id });
}

function calcularStreaks(datasOrdenadas: string[]): { atual: number; recorde: number } {
  // datasOrdenadas: únicas, em ordem decrescente (mais recente primeiro)
  const hoje = getDateString();
  const ontem = getDateString(-1);

  let atual = 0;
  if (datasOrdenadas.length > 0 && (datasOrdenadas[0] === hoje || datasOrdenadas[0] === ontem)) {
    atual = 1;
    for (let i = 1; i < datasOrdenadas.length; i++) {
      const esperada = getDateString(-i - (datasOrdenadas[0] === hoje ? 0 : 1));
      if (datasOrdenadas[i] === esperada) {
        atual++;
      } else {
        break;
      }
    }
  }

  let recorde = 0;
  let sequenciaAtual = 0;
  for (let i = 0; i < datasOrdenadas.length; i++) {
    if (i === 0) {
      sequenciaAtual = 1;
    } else {
      const anterior = new Date(datasOrdenadas[i - 1] + "T00:00:00Z");
      const atualData = new Date(datasOrdenadas[i] + "T00:00:00Z");
      const diffDias = Math.round((anterior.getTime() - atualData.getTime()) / (1000 * 60 * 60 * 24));
      sequenciaAtual = diffDias === 1 ? sequenciaAtual + 1 : 1;
    }
    recorde = Math.max(recorde, sequenciaAtual);
  }
  recorde = Math.max(recorde, atual);

  return { atual, recorde };
}

router.get("/streak", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;

  await registrarAtividadeHoje(userId);

  const registros = await db
    .select({ data: atividadeDiariaTable.data })
    .from(atividadeDiariaTable)
    .where(eq(atividadeDiariaTable.userId, userId));

  const datasOrdenadas = Array.from(new Set(registros.map((r) => r.data))).sort((a, b) => (a < b ? 1 : -1));

  const { atual, recorde } = calcularStreaks(datasOrdenadas);

  const selos = MARCOS.filter((m) => recorde >= m);
  const proximoMarco = MARCOS.find((m) => recorde < m) ?? null;

  res.json({
    streakAtual: atual,
    recorde,
    selosConquistados: selos,
    proximoMarco,
    diasParaProximoMarco: proximoMarco ? proximoMarco - atual : null,
  });
});

export default router;
