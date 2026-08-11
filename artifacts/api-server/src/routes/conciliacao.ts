import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, conciliacoesTable, conciliacaoItensTable, entradasTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const PROMPT = `Analise este documento (comprovante de pagamento, relatório de maquininha de cartão, ou extrato bancário) e extraia TODAS as transações financeiras que encontrar (uma lista, pode ter 1 ou várias).

Responda SOMENTE com um JSON válido no seguinte formato, sem markdown, sem texto extra:
{
  "transacoes": [
    {
      "data": "YYYY-MM-DD",
      "valor": número em reais (ex: 150.50),
      "tipo": "pix" ou "cartao_credito" ou "cartao_debito" ou "outro",
      "descricao": "breve descrição, nome do pagador ou identificação, se houver"
    }
  ],
  "erro": null (ou mensagem se não conseguiu ler o documento)
}

Extraia quantas transações encontrar no documento. Se não conseguir identificar algum campo de uma transação, use null nesse campo específico.`;

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

router.post("/conciliacao/upload", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const { arquivoBase64, mimeType, tipo } = req.body;

  if (!arquivoBase64) {
    res.status(400).json({ erro: "Arquivo não fornecido" });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(503).json({ erro: "Funcionalidade não configurada." });
    return;
  }

  const mediaType = (mimeType || "image/jpeg") as string;
  const tipoDocumento = (tipo === "maquininha" || tipo === "extrato") ? tipo : "comprovante";

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { inline_data: { mime_type: mediaType, data: arquivoBase64 } },
                { text: PROMPT },
              ],
            },
          ],
          generationConfig: { maxOutputTokens: 4096 },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      logger.error({ status: response.status, error: errorText }, "Gemini API error (conciliacao)");
      res.status(502).json({ erro: "Erro ao processar arquivo com IA. Tente novamente." });
      return;
    }

    const data = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    let extracted: { transacoes?: Array<{ data?: string; valor?: number; tipo?: string; descricao?: string }>; erro?: string };
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      extracted = JSON.parse(jsonMatch[0]);
    } catch {
      logger.error({ text }, "Failed to parse Gemini response as JSON (conciliacao)");
      res.status(422).json({ erro: "Não foi possível extrair informações deste arquivo." });
      return;
    }

    const transacoes = extracted.transacoes || [];

    const [conciliacao] = await db
      .insert(conciliacoesTable)
      .values({ userId, tipo: tipoDocumento, totalItens: transacoes.length })
      .returning();

    const todasEntradas = await db.select().from(entradasTable).where(eq(entradasTable.userId, userId));

    let totalCorrespondidos = 0;
    const itensCriados = [];

    for (const t of transacoes) {
      let entradaEncontrada = null;
      if (t.valor && t.data) {
        const dataMin = addDays(t.data, -3);
        const dataMax = addDays(t.data, 3);
        entradaEncontrada = todasEntradas.find((e) => {
          const valorBate = Math.abs(Number(e.valor) - t.valor!) < 0.01;
          const dataRef: string = e.dataPagamento ?? e.vencimento;
          const dataBate = dataRef >= dataMin && dataRef <= dataMax;
          return valorBate && dataBate;
        });
      } else if (t.valor) {
        entradaEncontrada = todasEntradas.find((e) => Math.abs(Number(e.valor) - t.valor!) < 0.01);
      }

      const status = entradaEncontrada ? "correspondido" : "nao_encontrado";
      if (entradaEncontrada) totalCorrespondidos++;

      const [item] = await db
        .insert(conciliacaoItensTable)
        .values({
          conciliacaoId: conciliacao.id,
          userId,
          data: t.data || null,
          valor: String(t.valor ?? 0),
          tipo: t.tipo || null,
          descricao: t.descricao || null,
          status,
          entradaId: entradaEncontrada?.id ?? null,
        })
        .returning();
      itensCriados.push(item);
    }

    await db
      .update(conciliacoesTable)
      .set({ totalCorrespondidos })
      .where(eq(conciliacoesTable.id, conciliacao.id));

    res.json({
      conciliacao: { ...conciliacao, totalCorrespondidos },
      itens: itensCriados,
      erro: extracted.erro || null,
    });
  } catch (err) {
    logger.error({ err }, "Error in conciliacao/upload");
    res.status(500).json({ erro: "Erro interno ao processar arquivo." });
  }
});

router.get("/conciliacao", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const conciliacoes = await db
    .select()
    .from(conciliacoesTable)
    .where(eq(conciliacoesTable.userId, userId))
    .orderBy(conciliacoesTable.createdAt);

  const resultado = [];
  for (const c of conciliacoes.reverse()) {
    const itens = await db.select().from(conciliacaoItensTable).where(eq(conciliacaoItensTable.conciliacaoId, c.id));
    resultado.push({ ...c, itens });
  }

  res.json(resultado);
});

export default router;
