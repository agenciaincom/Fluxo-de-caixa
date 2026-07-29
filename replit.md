# Fluxo de Caixa

Sistema de controle financeiro para pequenas empresas — gestão de entradas (contas a receber) e saídas (contas a pagar) com dashboard, avisos automáticos, relatório semanal e leitura de documentos por IA.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — API (porta 8080)
- `pnpm --filter @workspace/fluxo-caixa run dev` — Frontend React+Vite (porta dinâmica)
- `pnpm run typecheck` — typecheck completo
- `pnpm --filter @workspace/api-spec run codegen` — regenera hooks e schemas Zod da spec OpenAPI
- `pnpm --filter @workspace/db run push` — aplica mudanças de schema no banco (dev)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind v4, Shadcn/ui, Wouter, TanStack Query, Recharts
- Auth: Clerk (Replit-managed), cookie-based, sem tokens manuais
- API: Express 5, Drizzle ORM + PostgreSQL
- Validação: Zod (zod/v4), drizzle-zod
- Codegen: Orval (da spec OpenAPI)
- IA: Google Gemini 2.0 Flash Lite (chave GEMINI_API_KEY) — extração de dados de imagens (free tier disponível)

## Where things live

- `lib/api-spec/openapi.yaml` — source-of-truth dos contratos de API
- `lib/db/src/schema/entradas.ts` — tabela de contas a receber
- `lib/db/src/schema/saidas.ts` — tabela de contas a pagar
- `artifacts/api-server/src/routes/` — rotas Express (entradas, saidas, dashboard, avisos, relatorio, scan)
- `artifacts/api-server/src/middlewares/requireAuth.ts` — middleware Clerk
- `artifacts/fluxo-caixa/src/pages/` — páginas React (dashboard, entradas, saidas, avisos, relatorio, scan, home)
- `artifacts/fluxo-caixa/src/components/layout.tsx` — sidebar desktop / bottom nav mobile

## Architecture decisions

- Auth via Clerk cookie-based (sem Bearer tokens no frontend web)
- Todos os dados filtrados por `userId` do Clerk — multi-tenant pronto
- Valores monetários armazenados como `numeric` no Postgres, parseados para `number` nas respostas
- Datas de vencimento como `date` (modo string YYYY-MM-DD) — sem drift de timezone
- Extração de imagem: base64 no body JSON (limite 10mb configurado no Express)

## Product

- **Dashboard**: saldo atual, total a receber, total a pagar
- **Entradas**: cadastro e gestão de contas a receber (clientes)
- **Saídas**: cadastro e gestão de contas a pagar (fornecedores)
- **Avisos**: alertas automáticos de vencimentos (hoje/amanhã), gerador de mensagem de cobrança para WhatsApp
- **Relatório Semanal**: navegação semana a semana, gráfico de barras, botão copiar resumo
- **Adicionar por Foto**: envia imagem, IA extrai dados para formulário editável

## User preferences

- Interface completamente em Português do Brasil
- Visual: navy (#0B1C42) + dourado (#C99A2E) + creme (#F6F1E4)
- Tipografia: Playfair Display (títulos) + Inter (corpo)
- Mobile-first — iPad e celular são os aparelhos principais

## Gotchas

- Não use Bearer tokens ou setAuthTokenGetter no web — Clerk usa cookies
- Rotas Clerk no Wouter precisam do `/*?` (ex: `/sign-in/*?`) — obrigatório
- `tailwindcss({ optimize: false })` no vite.config.ts — evita bug de CSS layer em prod
- Google Fonts @import deve ser a PRIMEIRA linha do index.css
- Após mudança em `lib/*`, rodar `pnpm run typecheck:libs` antes dos artifacts

## Pointers

- Ver `pnpm-workspace` skill para estrutura do monorepo
- Ver `clerk-auth` skill para troubleshooting de autenticação
