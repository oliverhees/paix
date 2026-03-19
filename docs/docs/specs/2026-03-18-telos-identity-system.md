# TELOS Identity System — Design Spec

**Date:** 2026-03-18
**Phase:** Phase 2: TELOS + Graphiti
**Status:** Approved

## Overview

TELOS gives PAIONE knowledge about *who the user is* — their goals, beliefs, challenges, and life projects. It consists of 10 Markdown files with keyword-based relevance scoring within a 1,000-token budget.

## The 10 Dimensions

| Dimension | File | Describes |
|-----------|------|-----------|
| Mission | `mission.md` | Life purpose, core motivation |
| Goals | `goals.md` | Short/medium/long-term goals |
| Beliefs | `beliefs.md` | Values, convictions, principles |
| Challenges | `challenges.md` | Current problems, blockers |
| Projects | `projects.md` | Active projects, ventures |
| Strategies | `strategies.md` | Approaches, plans |
| Ideas | `ideas.md` | Ideas, concepts, brainstorms |
| Models | `models.md` | Mental models, frameworks |
| Narratives | `narratives.md` | Personal history, context |
| Learnings | `learnings.md` | Insights, lessons learned |

## Architecture

```
Message in
    ↓
Keyword matching against all 10 TELOS files
    ↓
Score per dimension (0.0 - 1.0)
    ↓
Top-N dimensions until 1,000 token budget filled
    ↓
Fallback: mission.md + goals.md if no match
    ↓
→ Context Assembler (Temporal + Persona + TELOS)
```

## File Locations

| Path | Purpose |
|------|---------|
| `USER/groups/telos/*.md` | User's TELOS files (global, one identity) |
| `SYSTEM/defaults/telos/en/*.md` | English fallback templates |
| `SYSTEM/defaults/telos/de/*.md` | German fallback templates |

TELOS is global (not per-group). Persona defines how PAIONE communicates (per-group). TELOS defines who the user IS.

## Relevance Scoring Algorithm

1. **Keyword extraction:** Extract significant words from each TELOS file (words > 3 chars, no stop words)
2. **Category keywords:** Each dimension has fixed base keywords (e.g., goals → "goal", "want", "plan", "achieve", "target")
3. **Matching:** Message is tokenized, matched against each dimension's keyword set
4. **Score:** `matchCount / totalKeywords` → normalized to 0-1
5. **Selection:** Dimensions sorted by score descending, token budget filled until 1,000 reached
6. **Per-dimension cap:** Each dimension truncated to ~200 tokens before entering the pool
7. **Fallback:** If all scores = 0, load `mission.md` + `goals.md` (~200 tokens total)

## Modules

### `SYSTEM/src/memory/telos-loader.ts`

```typescript
interface TelosResult {
  content: string;
  tokens: number;
  dimensions: string[];  // Which dimensions were loaded
  scores: Record<string, number>;  // Score per dimension
}

function loadTelos(
  message: string,
  userDir: string,
  systemDir: string,
  locale?: string,
): Promise<TelosResult>
```

### Integration in Context Assembler

```typescript
// In assembler.ts — add after persona loading:
const telos = await loadTelos(message, options.userDir, options.systemDir, options.locale);
if (telos.content) {
  sections.push(telos.content);
  tokenCounts.telos = telos.tokens;
}
```

## Token Budget

- **Total TELOS budget:** 1,000 tokens (from `TELOS_BUDGET` constant)
- **Per-dimension cap:** ~200 tokens (truncated via `truncateToTokenBudget`)
- **Typical load:** 3-5 dimensions per message
- **Fallback load:** ~200 tokens (mission + goals)

## Stop Words

English: the, a, an, is, are, was, were, be, been, being, have, has, had, do, does, did, will, would, shall, should, may, might, must, can, could, this, that, these, those, i, you, he, she, it, we, they, me, him, her, us, them, my, your, his, its, our, their, what, which, who, whom, when, where, why, how, not, no, nor, and, but, or, so, if, then, than, too, very, just, about, above, after, again, all, also, am, any, as, at, back, because, before, between, both, by, came, come, each, even, for, from, get, got, had, has, here, her, him, his, how, in, into, its, just, like, make, many, me, more, most, much, new, now, of, on, one, only, or, other, our, out, over, said, same, see, she, some, still, such, take, tell, than, that, the, their, them, then, there, these, they, this, those, through, to, too, under, up, us, use, was, way, we, well, were, what, when, where, which, while, who, why, will, with, would, you

German: der, die, das, ein, eine, ist, sind, war, waren, sein, haben, hat, hatte, werden, wird, wurde, kann, können, soll, muss, und, oder, aber, wenn, dann, als, auch, noch, schon, nur, nicht, kein, keine, ich, du, er, sie, es, wir, ihr, mein, dein, sein, ihr, unser, euer, was, wer, wie, wo, warum, wann, mit, von, zu, auf, in, an, für, über, unter, nach, vor, aus, bei, durch, um, bis, gegen

## Out of Scope

- No LLM calls for scoring (keyword heuristic only)
- No automatic writing/updating of TELOS files (Phase 3: Continuous Learning)
- No per-group TELOS (global only)
- No Graphiti integration (separate spec)

## GitHub Issues

1. `feat(memory): implement TELOS loader with keyword relevance scoring`
2. `feat(memory): integrate TELOS into context assembler`
3. `test(memory): add comprehensive TELOS loader tests`
4. `docs: add TELOS documentation to Nextra (EN + DE)`
