# Plano Operacional de Desenvolvimento com Agents para Sistema de Investimentos no Brasil

## Visão geral

Este documento consolida a estrutura operacional para desenvolvimento de um sistema de gerenciamento de investimentos voltado ao investidor brasileiro, inspirado conceitualmente em um projeto modular como o Wealthfolio, mas reposicionado para uma stack web-first com Next.js, TypeScript e PostgreSQL.[cite:2][cite:3] O plano parte de práticas de ledger financeiro rastreável em PostgreSQL, uso disciplinado de GitHub Copilot com instruções persistentes, e uma arquitetura de múltiplos agents com um agent orquestrador/supervisor no topo do fluxo.[cite:49][cite:51][cite:64][cite:70][cite:78][cite:90]

## Como executar localmente

- Guia rapido de execucao: [run.md](run.md)

## Decisões-base

| Tema | Decisão |
|------|---------|
| Stack principal | Next.js + TypeScript + PostgreSQL |
| Estratégia arquitetural | Modular monolith com separação por módulos de domínio |
| Banco | PostgreSQL gerenciado, com uso local via Docker no desenvolvimento |
| IA para desenvolvimento | GitHub Copilot Pro, usando os modelos disponíveis no plano e agent mode no VS Code.[cite:35][cite:37][cite:43] |
| Estratégia de agents | Arquitetura-alvo com Orchestrator, Planner, Implementer, Reviewer, Documenter e Memory Manager.[cite:78][cite:83][cite:89] |
| Abordagem operacional | Início em fluxo controlado tipo Nível 2.5 com evolução para Nível 3 formal |
| Foco da V1 | Ledger confiável, consolidação patrimonial, proventos, dashboard e importação inicial |

## Arquitetura dos agents

### Topologia

O padrão recomendado é um **supervisor/orchestrator** central que classifica tarefas, delega por especialidade, controla dependências, evita paralelismo inseguro e consolida o resultado final.[cite:78][cite:80][cite:84][cite:86] Esse padrão é mais seguro do que permitir comunicação livre entre agents, especialmente em tarefas de desenvolvimento que tocam schema, regras de negócio e múltiplos arquivos.[cite:78][cite:85][cite:89]

### Hierarquia de agents

1. **Orchestrator Agent** — recebe objetivo, classifica, roteia e fecha o ciclo.[cite:78][cite:83][cite:86]
2. **Planner Agent** — quebra épicos e features em subtarefas executáveis.
3. **Implementer Agent** — implementa mudanças no código de forma cirúrgica.
4. **Reviewer Agent** — revisa integridade, riscos, aderência arquitetural e qualidade.
5. **Documenter Agent** — atualiza documentação, ADRs, runbooks e estado da feature.[cite:64][cite:67]
6. **Memory Manager Agent** — recupera e persiste contexto, decisões, pendências e histórico.

### Fluxo operacional

1. Entrada de objetivo.
2. Leitura de memória relevante.
3. Classificação pelo Orchestrator.
4. Planejamento pelo Planner.
5. Distribuição de subtarefas.
6. Implementação.
7. Revisão.
8. Documentação.
9. Persistência de memória.
10. Consolidação e encerramento pelo Orchestrator.[cite:78][cite:80][cite:85]

## Estrutura de pastas sugerida

```text
repo/
├── apps/
│   └── web/
│       ├── src/
│       │   ├── app/
│       │   ├── components/
│       │   ├── modules/
│       │   │   ├── auth/
│       │   │   ├── portfolios/
│       │   │   ├── institutions/
│       │   │   ├── accounts/
│       │   │   ├── assets/
│       │   │   ├── transactions/
│       │   │   ├── income/
│       │   │   ├── positions/
│       │   │   ├── imports/
│       │   │   ├── market-data/
│       │   │   ├── dashboard/
│       │   │   ├── assistant/
│       │   │   └── rentals/
│       │   ├── lib/
│       │   │   ├── db/
│       │   │   ├── ledger/
│       │   │   ├── money/
│       │   │   ├── dates/
│       │   │   ├── logging/
│       │   │   ├── memory/
│       │   │   └── agents/
│       │   └── styles/
│       └── tests/
├── docs/
│   ├── architecture/
│   ├── domain/
│   ├── modules/
│   ├── decisions/
│   ├── runbooks/
│   ├── agents/
│   └── importers/
├── memory/
│   ├── project-overview.md
│   ├── current-state.md
│   ├── decisions.md
│   ├── open-questions.md
│   ├── tasks/
│   ├── orchestrator/
│   │   ├── active-queue.md
│   │   ├── completed-queue.md
│   │   ├── routing-rules.md
│   │   └── parallelization-policy.md
│   └── agents/
│       ├── planner.md
│       ├── implementer.md
│       ├── reviewer.md
│       ├── documenter.md
│       └── memory-manager.md
├── .github/
│   ├── copilot-instructions.md
│   ├── pull_request_template.md
│   └── ISSUE_TEMPLATE/
├── scripts/
├── docker/
└── package.json
```

## Árvore detalhada de tarefas

### Fase 0 — Fundação

#### Épico 0.1 — Base do repositório
- Criar repositório e estrutura inicial.
- Inicializar Next.js + TypeScript.
- Configurar lint, format, typecheck e testes.
- Criar README operacional.
- Criar `.env.example` e validação de variáveis.

#### Épico 0.2 — Banco e ambiente local
- Subir PostgreSQL com Docker Compose.
- Configurar ORM/migrations.
- Criar conexão local.
- Criar migration inicial.
- Criar scripts `db:start`, `db:reset`, `db:migrate`, `db:seed`.

#### Épico 0.3 — Convenções e governança
- Criar `docs/architecture/overview.md`.
- Criar template ADR em `docs/decisions/`.[cite:64][cite:67][cite:71]
- Criar convenção de nomes para módulos, tabelas, migrations e casos de uso.
- Criar checklist de mudanças que exigem ADR.

#### Épico 0.4 — Agents e memória
- Criar `docs/agents/roles.md`.
- Criar `docs/agents/handoff.md`.
- Criar `.github/copilot-instructions.md` com contexto persistente para o Copilot.[cite:70][cite:73]
- Criar arquivos base de memória.
- Criar política inicial de logs de desenvolvimento.

### Fase 1 — Domínio nuclear

#### Épico 1.1 — Usuários e portfólios
- Criar tabelas `users` e `portfolios`.
- Criar serviços de criação, leitura e associação.
- Criar testes de integridade.

#### Épico 1.2 — Instituições e contas
- Criar `institutions`.
- Criar `accounts`.
- Definir tipos de conta.
- Criar CRUD inicial.

#### Épico 1.3 — Catálogo de ativos
- Criar `asset_classes` com seed inicial.
- Criar `assets`.
- Criar `asset_identifiers`.
- Permitir ativos customizados.

#### Épico 1.4 — Ledger
- Criar `transactions`.
- Criar `ledger_entries`.
- Definir tipos de operação.
- Garantir rastreabilidade por referência única.[cite:49][cite:51]
- Testar compra, venda, aporte e saque.

#### Épico 1.5 — Idempotência e segurança transacional
- Criar `idempotency_records`.
- Implementar verificação de replay seguro.[cite:69][cite:72]
- Criar testes de duplicidade e retry.

### Fase 2 — Consolidação patrimonial

#### Épico 2.1 — Cálculo de posição
- Criar serviços de posição por ativo.
- Criar agregação por classe.
- Criar agregação por conta e portfólio.
- Tratar custo médio inicial.

#### Épico 2.2 — Rendimentos e recebimentos
- Criar `income_events`.
- Criar `rental_receipts`.
- Permitir entrada manual de dividendos, JCP, rendimentos e aluguéis.

#### Épico 2.3 — Camada de leitura
- Criar snapshots ou materialized views para dashboards.[cite:52]
- Criar rotinas de atualização on-demand.
- Criar índices principais.

#### Épico 2.4 — Dashboard inicial
- Patrimônio total.
- Patrimônio por classe.
- Recebimentos do mês.
- Últimas operações.
- Posição por ativo.

### Fase 3 — Importação

#### Épico 3.1 — Contrato de importação
- Criar `import_jobs`, `import_rows`, `import_errors`.
- Criar status e lifecycle da importação.

#### Épico 3.2 — CSV/planilha padrão
- Definir colunas aceitas.
- Criar parser.
- Criar normalizador.
- Criar validador por linha.

#### Épico 3.3 — Preview e reconciliação
- Criar pré-visualização.
- Detectar duplicidades.
- Permitir confirmação/cancelamento.
- Aplicar em transação única quando necessário.[cite:69][cite:72]

#### Épico 3.4 — Auditoria do importador
- Registrar logs por job.
- Relacionar linhas com transações geradas.
- Criar documentação do importador.

### Fase 4 — Sistema real de agents

#### Épico 4.1 — Orchestrator Agent
- Definir prompt-base.
- Definir tipos de tarefa.
- Definir política de roteamento.[cite:78][cite:80][cite:83]
- Definir política de paralelismo.[cite:84][cite:88]
- Definir critérios de replanejamento.
- Definir quando pedir ADR.

#### Épico 4.2 — Planner Agent
- Criar prompt-base.
- Criar template de decomposição.
- Criar template de critérios de aceite.

#### Épico 4.3 — Implementer Agent
- Criar prompt-base.
- Criar checklist de implementação cirúrgica.
- Criar formato de relatório de arquivos alterados.

#### Épico 4.4 — Reviewer Agent
- Criar prompt-base.
- Criar matriz de revisão: domínio, schema, segurança, performance, docs.
- Criar formato de parecer.

#### Épico 4.5 — Documenter Agent
- Criar prompt-base.
- Criar fluxos de atualização de docs, ADRs e changelog.[cite:64][cite:67]

#### Épico 4.6 — Memory Manager Agent
- Criar prompt-base.
- Criar formato de resumo de estado.
- Criar política de recuperação de contexto.

#### Épico 4.7 — Logs e fila do Orchestrator
- Criar `orchestrator_runs`.
- Criar `orchestrator_tasks`.
- Criar `task_dependencies`.
- Criar `agent_assignments`.
- Criar `handoff_records`.

### Fase 5 — Documentação viva

#### Épico 5.1 — ADRs
- Registrar decisões-base.
- Definir numeração.
- Criar índice de decisões.[cite:64][cite:67][cite:71]

#### Épico 5.2 — Contratos por módulo
- Criar documento de objetivo, invariantes, entidades e dependências por módulo.

#### Épico 5.3 — Runbooks
- Criar runbooks de setup.
- Criar runbooks de recuperação de contexto.
- Criar runbooks de execução de tarefa com agents.

### Fase 6 — Market data e evolução da leitura

#### Épico 6.1 — Quotes
- Criar `market_quotes`.
- Criar provider inicial.
- Registrar origem e timestamp.

#### Épico 6.2 — Câmbio
- Criar `fx_rates`.
- Converter para BRL.

#### Épico 6.3 — Performance
- Criar retorno simples.
- Criar valorização nominal.
- Criar acumulado de recebimentos.

### Fase 7 — Assistente explicativo

#### Épico 7.1 — Serviços de leitura para IA
- Criar queries especializadas para perguntas sobre carteira.
- Evitar acesso bruto e irrestrito ao banco pelo LLM.

#### Épico 7.2 — Prompt do assistente
- Responder com base apenas em dados disponíveis.
- Não recomendar compra ou venda na V1.
- Explicar composição, concentração e eventos.

#### Épico 7.3 — Memória do assistente
- Registrar preferências úteis.
- Separar memória de produto e memória do usuário.

### Fase 8 — Expansão

#### Épico 8.1 — Renda fixa ampliada
- indexadores
- cupons
- vencimento
- amortização

#### Épico 8.2 — Imóveis ampliados
- múltiplos imóveis
- despesas
- receita líquida
- documentos

#### Épico 8.3 — Importadores adicionais
- novos CSVs
- OFX futuro
- corretoras futuras

#### Épico 8.4 — Preparação fiscal
- classificação tributária
- relatórios de apoio
- sem apuração completa no início

## Política de tamanho de tarefas

### Pequena
- 1 tabela ou entidade
- 1 migration
- 1 serviço simples
- 1 teste principal

### Média
- 2 a 4 entidades relacionadas
- 1 fluxo completo pequeno
- 1 tela simples
- 3 a 6 testes

### Grande
- Deve ser quebrada obrigatoriamente pelo Planner antes de ir ao Implementer.[cite:90]

## Política de paralelismo do Orchestrator

### Pode paralelizar
- documentação e runbook
- seed inicial e tela administrativa simples
- testes de leitura e atualização de docs
- módulos sem arquivos ou tabelas compartilhadas

### Não pode paralelizar
- duas migrations concorrentes do mesmo domínio
- alteração simultânea no ledger e no cálculo de posição
- revisão estrutural do mesmo módulo por múltiplos agents
- importador e refatoração de schema no mesmo conjunto de entidades.[cite:84][cite:88]

## Prompts para VS Code

## Orchestrator Agent

```text
Você é o Orchestrator Agent deste projeto. Sua função é receber uma demanda de desenvolvimento, consultar o contexto salvo, classificar o tipo da tarefa, quebrar o trabalho em blocos executáveis, decidir a sequência ideal, identificar dependências, evitar paralelismo inseguro e distribuir a tarefa para os agents corretos.

Regras obrigatórias:
1. Sempre consulte a memória do projeto antes de planejar.
2. Nunca envie uma tarefa grande diretamente ao Implementer sem quebrá-la.
3. Nunca permita paralelismo quando houver chance de conflito de schema, domínio, ledger ou arquivos centrais.
4. Sempre exija critérios de aceite verificáveis.
5. Sempre indique quando ADR é obrigatório.
6. Sempre gere saída em formato estruturado.

Formato de saída:
- Objetivo
- Tipo da tarefa
- Contexto recuperado
- Subtarefas
- Dependências
- Ordem sugerida
- Paralelismo permitido/não permitido
- Agent responsável por cada subtarefa
- Critérios de aceite
- Riscos
- Decisão sobre ADR
- Próximo passo imediato
```

## Planner Agent

```text
Você é o Planner Agent deste projeto. Sua função é transformar um objetivo em subtarefas pequenas, verificáveis e alinhadas à arquitetura definida.

Contexto obrigatório:
- Stack: Next.js + TypeScript + PostgreSQL
- Arquitetura: modular monolith
- Banco orientado a ledger rastreável
- Projeto com documentação viva, memória persistente e agents especializados

Regras:
1. Não implemente nada.
2. Não invente escopo fora do objetivo.
3. Quebre tarefas grandes em subtarefas pequenas ou médias.
4. Descreva dependências explícitas.
5. Gere critérios de aceite claros.
6. Identifique riscos técnicos.
7. Indique arquivos ou módulos prováveis de impacto.

Formato de saída:
- Objetivo
- Escopo incluído
- Escopo excluído
- Subtarefas numeradas
- Dependências
- Arquivos/módulos prováveis
- Critérios de aceite por subtarefa
- Riscos e dúvidas
```

## Implementer Agent

```text
Você é o Implementer Agent deste projeto. Sua função é executar apenas a subtarefa recebida, com mudanças cirúrgicas, respeitando arquitetura, domínio financeiro e convenções do repositório.

Regras:
1. Execute apenas o escopo informado.
2. Não refatore partes não solicitadas.
3. Preserve integridade do ledger e regras de idempotência.
4. Se houver ambiguidade, pare e sinalize.
5. Liste claramente os arquivos alterados.
6. Sugira testes mínimos necessários.
7. Atualize comentários e docs locais apenas se forem impactados diretamente.

Formato de saída:
- Subtarefa executada
- Decisões tomadas
- Arquivos alterados
- Resumo das mudanças
- Riscos restantes
- Testes necessários
- Pendências para revisão
```

## Reviewer Agent

```text
Você é o Reviewer Agent deste projeto. Sua função é revisar criticamente a mudança recebida quanto a domínio, segurança, consistência arquitetural, risco de regressão, documentação e qualidade técnica.

Regras:
1. Revise com foco em integridade e não apenas estilo.
2. Preste atenção especial a schema, ledger, importação, idempotência, cálculos financeiros e memória persistente.
3. Não reimplemente; avalie.
4. Classifique o resultado como: aprovado, aprovado com ressalvas ou rejeitado.
5. Se rejeitar, indique exatamente o que precisa mudar.

Formato de saída:
- Status da revisão
- Problemas críticos
- Problemas médios
- Melhorias opcionais
- Riscos de regressão
- Impacto em domínio/schema/docs
- Próxima ação recomendada
```

## Documenter Agent

```text
Você é o Documenter Agent deste projeto. Sua função é manter a documentação viva, curta, coerente e útil para continuidade por humanos e agents.

Regras:
1. Atualize somente documentos impactados pela mudança.
2. Registre ADR quando a alteração mudar arquitetura, padrão, infraestrutura, fluxo crítico ou decisão estrutural.
3. Atualize changelog interno e estado atual da feature.
4. Evite documentação genérica.
5. Registre trade-offs relevantes.

Formato de saída:
- Documentos que devem ser atualizados
- Resumo do que muda em cada documento
- Necessidade de ADR: sim/não
- Texto-base sugerido para atualização
- Próximo documento prioritário
```

## Memory Manager Agent

```text
Você é o Memory Manager Agent deste projeto. Sua função é recuperar e persistir contexto relevante para manter continuidade lógica do desenvolvimento ao longo do tempo.

Regras:
1. Antes de cada tarefa, recupere contexto relevante.
2. Após cada tarefa, registre o novo estado.
3. Consolide decisões, pendências, riscos e próximos passos.
4. Evite duplicação de memória.
5. Priorize memória acionável e histórica.

Formato de saída:
- Contexto recuperado
- Decisões vigentes
- Estado atual da feature
- Pendências abertas
- Próximos passos
- Arquivos de memória a atualizar
```

## Prompt de recuperação de contexto

```text
Leia os arquivos em memory/ e docs/ relevantes para esta tarefa. Resuma:
1. o objetivo vigente,
2. o estado atual,
3. decisões já tomadas,
4. pendências em aberto,
5. riscos conhecidos,
6. documentos que precisam permanecer consistentes.
Não invente contexto ausente.
```

## Prompt de criação de ADR

```text
Crie um ADR curto e objetivo para esta decisão. Estruture em:
- Título
- Status
- Contexto
- Opções consideradas
- Decisão
- Consequências
- Trade-offs
Use linguagem direta e registre apenas o necessário para justificar a decisão futura.
```

## Prompt de task handoff

```text
Prepare um handoff para o próximo agent com o seguinte formato:
- objetivo recebido
- subtarefa executada
- arquivos tocados
- decisões tomadas
- limitações encontradas
- riscos pendentes
- próximo passo recomendado
Se faltar contexto, sinalize explicitamente.
```

## Primeira fila recomendada de execução

### Sprint 0
1. Inicializar repositório.
2. Subir PostgreSQL local.
3. Configurar ORM/migrations.
4. Criar `.github/copilot-instructions.md`.[cite:70][cite:73]
5. Criar estrutura `docs/` e `memory/`.
6. Criar template ADR.[cite:64][cite:67]
7. Criar docs dos agents.
8. Criar regras do Orchestrator.

### Sprint 1
1. `users`
2. `portfolios`
3. `institutions`
4. `accounts`
5. `asset_classes`
6. `assets`
7. `asset_identifiers`

### Sprint 2
1. `transactions`
2. `ledger_entries`
3. idempotência.[cite:69][cite:72]
4. testes de compra e venda
5. testes de duplicidade

### Sprint 3
1. `income_events`
2. `rental_receipts`
3. cálculo de posição
4. snapshots
5. dashboard inicial

## Checklist operacional por tarefa

- Contexto recuperado
- Tarefa classificada pelo Orchestrator
- Subtarefa planejada
- Critérios de aceite definidos
- Execução limitada ao escopo
- Revisão concluída
- Documentação atualizada
- Memória persistida
- Status consolidado

## Observações finais

A combinação de ledger em PostgreSQL, documentação curta com ADR, instruções persistentes para Copilot e padrão supervisor-worker para agents cria uma base coerente para evolução segura do produto e para desenvolvimento assistido por IA com menos perda de contexto, menor retrabalho e melhor rastreabilidade.[cite:49][cite:64][cite:70][cite:78][cite:90]
