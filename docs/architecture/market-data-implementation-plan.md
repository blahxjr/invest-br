# Plano Técnico: Market Data Multi-Provider (V2)

**Status:** Pronto para implementação  
**Data:** 2026-04-21  
**Escopo:** Atualização de cotação de ativos com fallback resiliente e opção de near-real-time

## 1. Objetivo

Evoluir o módulo de cotações para um modelo multi-provider, mantendo compatibilidade com o fluxo atual (`positions`, `dashboard`, `insights`) e reduzindo risco operacional por dependência de fonte única.

Objetivos específicos:
- Melhorar disponibilidade de cotações no horário de mercado.
- Permitir fallback automático entre provedores.
- Preservar comportamento resiliente (não quebrar UI quando API externa falhar).
- Preparar base para modo near-real-time (SSE/WebSocket) em etapa posterior.

## 2. Situação Atual (baseline)

- Fonte principal: Brapi (batch até 50 ativos, cache server-side 5 min).
- Erros externos não quebram a aplicação (retorno vazio/fallback silencioso).
- Sem persistência de snapshots de cotação no banco.
- Sem telemetria de qualidade por provedor (latência, taxa de erro, cobertura).

## 3. Pesquisa de provedores (síntese)

## 3.1 Brapi
- Forte aderência para B3 (ações, FIIs, ETFs, BDRs).
- Endpoint simples e bom fit com o modelo atual.
- Continua como candidato principal para ativos brasileiros.

Referência: https://brapi.dev/docs

## 3.2 Yahoo Finance (via yahoo-finance2)
- Biblioteca madura e tipada para Node.
- API não oficial e sem garantias de estabilidade/consistência por parte do Yahoo.
- Adequada como fallback opcional, não como fonte primária crítica.

Referências:
- https://github.com/gadicc/yahoo-finance2
- https://www.npmjs.com/package/yahoo-finance2

## 3.3 Finnhub
- API oficial com suporte a WebSocket e cotações em tempo real.
- Exige gestão rigorosa de limite/rate limit e token.
- Boa opção para expansão internacional e real-time em plano pago.

Referência: https://finnhub.io/docs/api

## 3.4 Massive (Polygon)
- Infra robusta para mercado dos EUA, com REST e WebSocket.
- Muito forte para equities US e casos de baixa latência.
- Menor foco natural em B3 como fonte primária.

Referências:
- https://massive.com/docs/rest/stocks/overview
- https://massive.com/docs/websocket/stocks/overview

## 3.5 Alpha Vantage
- Ampla cobertura e catálogo vasto, porém recursos realtime relevantes tendem a exigir plano premium.
- Útil como fallback adicional e para casos de dados complementares.

Referência: https://www.alphavantage.co/documentation/

## 3.6 Google Finance
- Não há API oficial pública suportada para uso de produção.
- Não recomendado como dependência crítica.

## 4. Estratégia recomendada

- **Primário (B3):** Brapi.
- **Secundário (fallback):** Yahoo Finance (opcional, controlado por flag).
- **Terciário (futuro/enterprise):** Finnhub ou Massive para expansão internacional e real-time.

Justificativa:
- Menor atrito para continuidade do comportamento já validado em produção local do projeto.
- Melhor equilíbrio entre custo inicial, cobertura Brasil e tempo de implementação.
- Mantém caminho evolutivo para WebSocket sem refatorar novamente a camada de domínio.

## 5. Arquitetura alvo

Criar camada de abstração por provedor:

- `src/modules/quotes/domain/types.ts`
  - `QuoteProviderId`
  - `ProviderQuote`
  - `ProviderResult`

- `src/modules/quotes/providers/brapi-provider.ts`
- `src/modules/quotes/providers/yahoo-provider.ts`
- `src/modules/quotes/providers/finnhub-provider.ts` (placeholder inicial)
- `src/modules/quotes/service/get-quotes.ts`
  - Orquestra prioridade/fallback
  - Normaliza payload para contrato único
  - Emite métricas de sucesso/falha/latência

- `src/lib/quotes.ts`
  - Mantido como fachada compatível (sem quebrar importadores existentes)

## 6. Roadmap por fases

## Fase 1: Base Multi-Provider (sem WebSocket)

### Entregáveis
- Interface de provedor e normalização unificada.
- Brapi como provider padrão.
- Yahoo como fallback opcional por feature flag.
- Métricas de observabilidade básicas por provider.

### Backlog por arquivo
- Criar `src/modules/quotes/domain/types.ts`.
- Criar `src/modules/quotes/providers/brapi-provider.ts`.
- Criar `src/modules/quotes/providers/yahoo-provider.ts`.
- Criar `src/modules/quotes/service/get-quotes.ts`.
- Adaptar `src/lib/quotes.ts` para delegar ao novo service.
- Adicionar variáveis em `.env.example` (ou documentação equivalente):
  - `QUOTE_PROVIDER_PRIMARY=brapi`
  - `QUOTE_PROVIDER_FALLBACKS=yahoo`
  - `YAHOO_ENABLED=false`

### Critérios de aceite
- Chamadas atuais continuam funcionando sem alterar contratos públicos.
- Em falha total do primário, fallback é tentado automaticamente.
- Em falha geral, tela não quebra (comportamento resiliente preservado).
- Testes cobrindo sucesso, timeout, 429 e fallback.

## Fase 2: Cache e Resiliência Operacional

### Entregáveis
- Cache por provider com TTL configurável.
- Retry com backoff para erros transitórios.
- Circuit breaker simples por provider (janela curta).

### Backlog por arquivo
- Criar `src/modules/quotes/service/cache.ts`.
- Criar `src/modules/quotes/service/resilience.ts`.
- Atualizar `src/modules/quotes/service/get-quotes.ts`.

### Critérios de aceite
- Redução de chamadas repetidas para o mesmo ticker no mesmo TTL.
- Erros 5xx e timeout não geram cascata de falha.
- Provider instável entra em estado aberto temporário e evita tempestade de requests.

## Fase 3: Near-real-time (opcional)

### Entregáveis
- Endpoint SSE no App Router para stream de atualização em janela de mercado.
- Atualização incremental da UI sem refresh completo.
- Feature flag para ativar somente em ambientes definidos.

### Backlog por arquivo
- Criar `src/app/api/quotes/stream/route.ts` (SSE inicial).
- Criar `src/modules/quotes/service/streaming.ts`.
- Adaptar componentes de `positions`/`dashboard` para hidratar atualizações.

### Critérios de aceite
- Atualizações periódicas em tempo de mercado sem degradar UX.
- Fallback automático para modo polling/cached quando stream indisponível.
- Sem regressão de desempenho em páginas críticas.

## 7. Observabilidade mínima

Registrar por provider:
- `request_count`
- `error_count`
- `timeout_count`
- `fallback_count`
- `p95_latency_ms`
- `quote_coverage_ratio` (tickers cotados / tickers solicitados)

## 8. Testes recomendados

- Unitários:
  - Normalização por provider.
  - Seleção de provider por prioridade.
  - Fallback em erro e em payload vazio.

- Integração:
  - Fluxo `positions` com quotes disponíveis e indisponíveis.
  - Fluxo `dashboard` com cobertura parcial.

- Contrato:
  - Garantir shape de `QuoteResult` atual para evitar regressão em consumidores existentes.

## 9. Riscos e mitigação

- Risco: dependência de API não oficial (Yahoo).
  - Mitigação: usar apenas como fallback opcional, com flag e monitoramento.

- Risco: rate limit em horário de pico.
  - Mitigação: batching, cache, retry com jitter e circuit breaker.

- Risco: divergência de símbolo entre provedores.
  - Mitigação: normalizador central de ticker com mapeamento por mercado.

## 10. Rollout sugerido

1. Deploy com arquitetura nova mantendo somente Brapi ativo.  
2. Ativar Yahoo fallback em ambiente de teste.  
3. Medir 7 dias de métricas.  
4. Liberar fallback em produção gradualmente por percentual de usuários (flag).  
5. Avaliar necessidade de provider enterprise (Finnhub/Massive) para próxima etapa.

## 11. Definição de pronto para iniciar implementação

- ADR de estratégia de provedores aprovada.
- Variáveis de ambiente definidas.
- Plano de testes aceito.
- Critérios de observabilidade acordados.
