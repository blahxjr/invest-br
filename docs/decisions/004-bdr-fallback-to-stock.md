# ADR-004: BDR com fallback para STOCK no import de Posição

**Status:** Aceito  
**Data:** 2026-04-13  
**Contexto:** Prompt 8 — Import B3

---

## Contexto

A planilha de Posição exportada pela B3 contém uma sheet dedicada a **BDRs** (Brazilian Depositary Receipts), como `ROXO34` (Nu Holdings). O parser de posição classifica corretamente esses ativos com `category: 'BDR'`.

Entretanto, o enum `AssetCategory` do schema Prisma atual define apenas:

```prisma
enum AssetCategory {
  STOCK
  FII
  ETF
  FIXED_INCOME
  CRYPTO
  CASH
  OTHER
}
```

`BDR` não está presente.

---

## Decisão

Aplicar fallback `BDR` → `STOCK` no **service de persistência** (`service.ts`), mantendo o parser retornando `'BDR'` corretamente no nível do domínio.

Isso garante:
1. O parser continua representando a realidade do dado B3
2. A persistência não quebra com enum inválido
3. A migração futura é trivial: adicionar `BDR` ao enum e remover o fallback

---

## Alternativas Consideradas

| Alternativa | Motivo da rejeição |
|---|---|
| Adicionar `BDR` ao enum agora | Escopo do Prompt 8 é import; alteração de schema requer migration e decisão de produto |
| Ignorar BDRs no import | Perda de dado real (ex: ROXO34 com 72 cotas no portfólio do usuário) |
| Usar `OTHER` como fallback | Menos semântico que `STOCK`; BDR é essencialmente uma ação estrangeira custodiada no Brasil |

---

## Consequências

- BDRs aparecem na categoria **Ações** no sistema até que `BDR` seja adicionado ao enum
- Nenhuma migration é necessária agora
- A próxima iteração que adicionar a tela de Posições ou filtros por categoria deve incluir `BDR` no enum como parte do escopo
