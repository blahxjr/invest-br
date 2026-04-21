# ADR-002: Estratégia de Provedores de Market Data

- Status: Proposto
- Data: 2026-04-21
- Decisores: Time invest-br
- Relacionado: ADR-001 (modelo ledger), módulo de cotações

## Contexto

O sistema atualmente depende de uma única integração de cotação (Brapi). A abordagem simplifica implementação, mas cria risco operacional em caso de indisponibilidade do provedor, aumento de latência ou limitação de throughput em horários de pregão.

Também há demanda por evolução para atualização mais frequente de preços e possibilidade futura de near-real-time.

## Decisão

Adotar arquitetura de cotações com múltiplos provedores, em ordem de prioridade, com fallback automático e normalização para contrato único interno.

Decisão inicial de prioridade:
1. Primário para ativos brasileiros: Brapi
2. Fallback opcional: Yahoo Finance via yahoo-finance2 (não oficial)
3. Provedor enterprise futuro (sob avaliação): Finnhub ou Massive

## Diretrizes

- O contrato público interno de cotação deve permanecer estável para consumidores atuais.
- Falha de API externa nunca pode quebrar as telas de carteira/dashboard.
- Seleção de providers deve ser controlável por configuração (variáveis de ambiente).
- Toda integração nova deve reportar métricas de disponibilidade, latência e cobertura.

## Consequências

### Positivas
- Menor risco de indisponibilidade por dependência única.
- Evolução incremental sem refatorar os módulos consumidores.
- Base preparada para streaming no futuro.

### Negativas
- Complexidade maior de manutenção e testes.
- Necessidade de governança de custos e limites por provider.
- Possível divergência de payload/símbolo entre fontes.

## Alternativas consideradas

1. Manter provedor único (Brapi)
- Rejeitada por risco de SPOF em cenário de crescimento.

2. Migrar integralmente para Yahoo
- Rejeitada por ser API não oficial para uso crítico como única fonte.

3. Migrar integralmente para Finnhub/Massive
- Adiada para etapa futura devido custo/escopo e foco atual em ativos BR.

## Plano de implementação

Executar em fases conforme documento técnico:
- `docs/architecture/market-data-implementation-plan.md`

## Critérios de revisão desta ADR

Revisar status de "Proposto" para "Aceito" após:
- Aprovação técnica do time.
- Definição final de configuração de produção.
- Execução da Fase 1 com testes e métricas mínimas.
