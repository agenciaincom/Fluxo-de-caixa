import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, entradasTable, saidasTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

function getDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function diasEntre(dataStr: string, hojeStr: string): number {
  const d1 = new Date(dataStr + "T00:00:00Z");
  const d2 = new Date(hojeStr + "T00:00:00Z");
  return Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

router.get("/dashboard", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const hoje = getDateString();

  const [entradas, saidas] = await Promise.all([
    db.select().from(entradasTable).where(eq(entradasTable.userId, userId)),
    db.select().from(saidasTable).where(eq(saidasTable.userId, userId)),
  ]);

  const entradasPagas = entradas
    .filter(e => e.status === "pago")
    .reduce((acc, e) => acc + parseFloat(e.valor), 0);

  const saidasPagas = saidas
    .filter(s => s.status === "pago")
    .reduce((acc, s) => acc + parseFloat(s.valor), 0);

  const entradasPendentes = entradas
    .filter(e => e.status === "pendente")
    .reduce((acc, e) => acc + parseFloat(e.valor), 0);

  const saidasPendentes = saidas
    .filter(s => s.status === "pendente")
    .reduce((acc, s) => acc + parseFloat(s.valor), 0);

  const saldoAtual = entradasPagas - saidasPagas;

  // Contas vencidas e não pagas (saídas comuns, não recorrentes)
  const saidasVencidas = saidas.filter(
    s => !s.recorrente && s.status === "pendente" && s.vencimento && s.vencimento < hoje
  );

  // Dinheiro parado: entradas pendentes com vencimento já passado
  const entradasAtrasadas = entradas
    .filter(e => e.status === "pendente" && e.vencimento < hoje)
    .map(e => ({
      id: e.id,
      cliente: e.cliente,
      valor: parseFloat(e.valor),
      vencimento: e.vencimento,
      diasAtraso: diasEntre(e.vencimento, hoje),
    }))
    .sort((a, b) => b.diasAtraso - a.diasAtraso);

  const totalPreso = entradasAtrasadas.reduce((acc, e) => acc + e.valor, 0);

  // Termômetro de saúde financeira
  let saude: "boa" | "atencao" | "critica" = "boa";
  let saudeMensagem = "Seu caixa está saudável.";

  if (saldoAtual < 0 || saidasVencidas.length > 0) {
    saude = "critica";
    saudeMensagem = saldoAtual < 0
      ? "Seu saldo atual está negativo."
      : `Você tem ${saidasVencidas.length} conta(s) vencida(s) e ainda não paga(s).`;
  } else if (entradasAtrasadas.length > 0) {
    saude = "atencao";
    saudeMensagem = `Você tem ${entradasAtrasadas.length} recebimento(s) atrasado(s), somando ${totalPreso.toFixed(2)}.`;
  }

  // Conquistas simples
  const conquistas: string[] = [];
  if (saldoAtual > 0) conquistas.push("💪 Seu caixa está positivo!");
  if (saidasVencidas.length === 0) conquistas.push("🎉 Nenhuma conta atrasada!");
  if (entradasAtrasadas.length === 0) conquistas.push("✅ Nenhum cliente com recebimento atrasado!");

  res.json({
    saldoAtual,
    totalAReceber: entradasPendentes,
    totalAPagar: saidasPendentes,
    entradasPagas,
    saidasPagas,
    entradasPendentes,
    saidasPendentes,
    saude,
    saudeMensagem,
    dinheiroPreso: entradasAtrasadas.slice(0, 5),
    totalPreso,
    conquistas,
  });
});

export default router;
