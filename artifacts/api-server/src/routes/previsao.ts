import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, entradasTable, saidasTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function diaOcorreNesseMes(diaVencimento: number, referencia: Date): boolean {
  const diasNoMes = new Date(referencia.getFullYear(), referencia.getMonth() + 1, 0).getDate();
  const diaAjustado = Math.min(diaVencimento, diasNoMes);
  return diaAjustado === referencia.getDate();
}

router.get("/previsao/30dias", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;

  const [entradas, saidas] = await Promise.all([
    db.select().from(entradasTable).where(eq(entradasTable.userId, userId)),
    db.select().from(saidasTable).where(eq(saidasTable.userId, userId)),
  ]);

  const entradasPagas = entradas.filter(e => e.status === "pago").reduce((acc, e) => acc + parseFloat(e.valor), 0);
  const saidasPagas = saidas.filter(s => s.status === "pago").reduce((acc, s) => acc + parseFloat(s.valor), 0);
  const saldoAtual = entradasPagas - saidasPagas;

  const entradasPendentes = entradas.filter(e => e.status === "pendente");
  const saidasComuns = saidas.filter(s => !s.recorrente && s.status === "pendente");
  const saidasRecorrentes = saidas.filter(s => s.recorrente && s.diaVencimento);

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  let saldoAcumulado = saldoAtual;
  let diaCritico: string | null = null;
  const dias: Array<{ data: string; saldoProjetado: number; entradas: number; saidas: number; eventos: string[] }> = [];

  for (let i = 1; i <= 30; i++) {
    const dataAtual = new Date(hoje);
    dataAtual.setDate(dataAtual.getDate() + i);
    const dataStr = formatDate(dataAtual);
    const eventos: string[] = [];

    let entradasDoDia = 0;
    for (const e of entradasPendentes) {
      if (e.vencimento === dataStr) {
        entradasDoDia += parseFloat(e.valor);
        eventos.push(`+ ${e.cliente}`);
      }
    }

    let saidasDoDia = 0;
    for (const s of saidasComuns) {
      if (s.vencimento === dataStr) {
        saidasDoDia += parseFloat(s.valor);
        eventos.push(`- ${s.descricao}`);
      }
    }

    for (const s of saidasRecorrentes) {
      if (!diaOcorreNesseMes(s.diaVencimento as number, dataAtual)) continue;
      if (s.recorrenciaVezes) {
        const criada = new Date(s.createdAt);
        const mesesDesdeInicio = (dataAtual.getFullYear() - criada.getFullYear()) * 12 + (dataAtual.getMonth() - criada.getMonth());
        if (mesesDesdeInicio >= s.recorrenciaVezes) continue;
      }
      const valor = parseFloat(s.valor || "0");
      if (valor > 0) {
        saidasDoDia += valor;
        eventos.push(`- ${s.descricao} (recorrente)`);
      }
    }

    saldoAcumulado += entradasDoDia - saidasDoDia;

    if (saldoAcumulado < 0 && !diaCritico) {
      diaCritico = dataStr;
    }

    dias.push({
      data: dataStr,
      saldoProjetado: Math.round(saldoAcumulado * 100) / 100,
      entradas: entradasDoDia,
      saidas: saidasDoDia,
      eventos,
    });
  }

  res.json({
    saldoAtual,
    diaCritico,
    dias,
  });
});

export default router;
