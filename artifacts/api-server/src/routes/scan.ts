import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const PROMPT = `Analise este documento (foto ou PDF) e extraia TODOS os lançamentos financeiros que encontrar — pode ser um único comprovante, uma lista com várias contas diferentes, várias parcelas de uma mesma fatura/boleto, ou uma mistura de tudo isso. NÃO leia só o primeiro item: percorra o documento inteiro e extraia cada linha/lançamento separadamente.

Responda SOMENTE com um JSON válido no seguinte formato, sem markdown, sem texto extra:
{
  "lancamentos": [
    {
      "tipo": "entrada" ou "saida" (entrada = receita/cliente vai pagar; saida = despesa/conta a pagar),
      "cliente": "nome do cliente ou pagador" (apenas para entradas, null para saídas),
      "descricao": "descrição ou nome do fornecedor/serviço" (para saídas),
      "valor": número em reais (ex: 150.50),
      "vencimento": "YYYY-MM-DD" (data de vencimento ou pagamento),
      "formaPagamento": "pix" ou "boleto" (se aplicável, senão null),
      "dadosPagamento": "chave pix ou código/link do boleto" (se encontrado, senão null),
      "status": "pago" se já estiver pago/quitado, "pendente" se ainda não pago,
      "observacao": "qualquer observação relevante, como número da parcela (ex: Parcela 2/6)" (opcional, null se não houver)
    }
  ],
  "erro": null (ou mensagem de erro se não conseguiu extrair nenhuma informação)
}

Extraia quantos lançamentos encontrar — pode ser 1, pode ser 20. Se não conseguir identificar algum campo de um lançamento específico, use null nesse campo, mas ainda assim inclua o lançamento na lista.

Hoje é {{HOJE}}.`;

router.post("/scan-imagem", requireAuth, async (req, res): Promise<void> => {
  const { imagemBase64, mimeType } = req.body;

  if (!imagemBase64) {
    res.status(400).json({ erro: "Arquivo não fornecido" });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(503).json({
      erro: "Funcionalidade de leitura não configurada. Configure a chave GEMINI_API_KEY.",
    });
    return;
  }

  const today = new Date().toISOString().split("T")[0];
  const mediaType = (mimeType || "image/jpeg") as string;
  const promptComData = PROMPT.replace("{{HOJE}}", today);

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
                {
                  inline_data: {
                    mime_type: mediaType,
                    data: imagemBase64,
                  },
                },
                {
                  text: promptComData,
                },
              ],
            },
          ],
          generationConfig: {
            maxOutputTokens: 4096,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      logger.error({ status: response.status, error: errorText }, "Gemini API error");
      res.status(502).json({ erro: "Erro ao processar arquivo com IA. Tente novamente." });
      return;
    }

    const data = await response.json() as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
        finishReason?: string;
      }>;
    };

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    let extracted: Record<string, unknown>;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      extracted = JSON.parse(jsonMatch[0]);
    } catch {
      logger.error({ text }, "Failed to parse Gemini response as JSON");
      res.status(422).json({ erro: "Não foi possível extrair informações deste arquivo." });
      return;
    }

    if (!Array.isArray(extracted.lancamentos)) {
      extracted.lancamentos = [];
    }

    res.json(extracted);
  } catch (err) {
    logger.error({ err }, "Error in scan-imagem");
    res.status(500).json({ erro: "Erro interno ao processar arquivo." });
  }
});

export default router;
