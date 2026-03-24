# Onboarding Agent Identity → Inbox Agent Documents

**Date:** 2026-03-24
**Status:** Approved

## Problem

The onboarding flow collects agent identity and user profile data but stores it only in `user.agentOnboarding.agentIdentity`. This data should instead be written directly to the inbox (lobeAi) agent's `agent_document` table as `IDENTITY.md` and `SOUL.md`, making it immediately available as durable agent context.

## Design Decisions

| Decision                 | Choice                                            | Rationale                                                                                                             |
| ------------------------ | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Write target             | Both IDENTITY.md and SOUL.md                      | Identity data fits IDENTITY.md; profile summaries enrich SOUL.md                                                      |
| Write mechanism          | Server-side in `commitActiveStep`                 | Secure, controlled; no cross-agent tool exposure needed                                                               |
| SOUL.md content strategy | Fixed template + profile section concatenation    | Deterministic, no LLM overhead; onboarding AI summaries already high quality                                          |
| AI polishing             | None                                              | Each node's `summary` field is already AI-generated during onboarding                                                 |
| SOUL.md regeneration     | Always from CLAW template constant + profile data | Deterministic; agent self-edits during onboarding are not preserved (acceptable since onboarding is a one-time setup) |

## Architecture

### Data Flow

```
commitActiveStep('agentIdentity')
  → upsert inbox IDENTITY.md (full content from name/vibe/emoji/nature)
  → upsert inbox SOUL.md (Core Truths + Boundaries + Vibe + Continuity, no profile sections yet)

commitActiveStep('userIdentity')
  → upsert inbox SOUL.md (fixed sections + "About My Human")

commitActiveStep('workStyle')
  → upsert inbox SOUL.md (fixed sections + accumulated profile sections + "How We Work Together")

commitActiveStep('workContext')
  → upsert inbox SOUL.md (fixed sections + accumulated profile sections + "Current Context")

commitActiveStep('painPoints')
  → upsert inbox SOUL.md (fixed sections + accumulated profile sections + "Where I Can Help Most")

commitActiveStep('responseLanguage')
  → no document write (saves to user.settings.general.responseLanguage)

commitActiveStep('summary')
  → no document write (terminal node)
```

`buildSoulDocument` always regenerates from the CLAW `SOUL_DOCUMENT.content` constant plus all profile sections present in `state.profile`. It does NOT read/parse existing SOUL.md from the database. This is deterministic and avoids fragile content parsing. Tradeoff: any agent self-edits to SOUL.md during onboarding would be overwritten. This is acceptable since onboarding is a one-time initial setup.

### IDENTITY.md Template

Written once during `agentIdentity` node commit. Uses CLAW template's load position (BEFORE_SYSTEM, priority 0).

```markdown
# IDENTITY.md - Who Am I?

- **Name:** {agentIdentity.name}
- **Creature:** {agentIdentity.nature}
- **Vibe:** {agentIdentity.vibe}
- **Emoji:** {agentIdentity.emoji}
```

### SOUL.md Structure

Retains existing CLAW SOUL.md fixed sections (from `SOUL_DOCUMENT.content` constant). Profile sections appended progressively as nodes complete. Uses SYSTEM_APPEND, priority 1.

```markdown
# SOUL.md - Who You Are

_You're not a chatbot. You're becoming someone._

## Core Truths

(existing fixed content from CLAW template constant)

## Boundaries

(existing fixed content)

## Vibe

(existing fixed content)

## Continuity

(existing fixed content)

---

## About My Human

{userIdentity.summary}

## How We Work Together

{workStyle.summary}

## Current Context

{workContext.summary}

- **Active Projects:** {workContext.activeProjects joined}
- **Interests:** {workContext.interests joined}
- **Tools:** {workContext.tools joined}

## Where I Can Help Most

{painPoints.summary}
```

Sections only appear after their corresponding node is committed. Empty/missing summaries are omitted.

### `buildSoulDocument` Pseudocode

```typescript
function buildSoulDocument(state: UserAgentOnboarding): string {
  // Start with fixed CLAW template content
  let content = SOUL_DOCUMENT.content;

  const profile = state.profile;
  if (!profile) return content;

  const sections: string[] = [];

  if (profile.identity?.summary) {
    sections.push(`## About My Human\n\n${profile.identity.summary}`);
  }

  if (profile.workStyle?.summary) {
    sections.push(`## How We Work Together\n\n${profile.workStyle.summary}`);
  }

  if (profile.workContext?.summary) {
    let section = `## Current Context\n\n${profile.workContext.summary}`;
    const lists = [];
    if (profile.workContext.activeProjects?.length)
      lists.push(`- **Active Projects:** ${profile.workContext.activeProjects.join(', ')}`);
    if (profile.workContext.interests?.length)
      lists.push(`- **Interests:** ${profile.workContext.interests.join(', ')}`);
    if (profile.workContext.tools?.length)
      lists.push(`- **Tools:** ${profile.workContext.tools.join(', ')}`);
    if (lists.length) section += '\n\n' + lists.join('\n');
    sections.push(section);
  }

  if (profile.painPoints?.summary) {
    sections.push(`## Where I Can Help Most\n\n${profile.painPoints.summary}`);
  }

  if (sections.length) {
    content += '\n\n---\n\n' + sections.join('\n\n');
  }

  return content;
}
```

## Implementation Changes

### Modified Files

1. **`src/server/services/onboarding/index.ts`**
   - Inject `AgentDocumentsService` dependency (or instantiate via `serverDB` + `userId`)
   - In `commitActiveStep`, after each relevant node commit, call document upsert
   - Remove write to `state.agentIdentity` (replaced by IDENTITY.md)
   - Keep `state.agentIdentity` readable for onboarding UI display (write to both state AND document, or read back from document)
   - Add helpers: `getInboxAgentId`, `buildIdentityDocument`, `buildSoulDocument`
   - Both IDENTITY.md and SOUL.md upserts in `agentIdentity` node should be in the same logical operation

2. **`packages/database/src/models/agentDocuments/agentDocument.ts`**
   - Verify `upsert()` by filename works correctly when the document already exists from template initialization (it should — `upsert` merges metadata and preserves loadPosition/loadRules when not explicitly provided)

### New Helpers (in onboarding service)

- `getInboxAgentId(): Promise<string>` — query `AgentModel` with inbox agent slug (`BUILTIN_AGENT_SLUGS.inbox` = `'inbox'`). If `AgentService.getBuiltinAgent()` does not return a raw ID, add `agentModel.getBuiltinAgentId(slug)` query.
- `buildIdentityDocument(agentIdentity): string` — render IDENTITY.md content from name/vibe/emoji/nature
- `buildSoulDocument(state): string` — render SOUL.md from CLAW template constant + accumulated profile sections (see pseudocode above)

### Unchanged

- Onboarding state machine, node flow, draft/questionSurface mechanics
- `state.profile` still written (used by onboarding UI for display)
- CLAW template definitions (templates remain as defaults for non-onboarded agents)
- Tool layer (`builtin-tool-agent-documents`) — no changes needed
- `AGENTS.md` document — untouched by onboarding flow

### Inbox Agent ID Resolution

Query via `AgentModel` using the inbox agent slug `BUILTIN_AGENT_SLUGS.inbox` (value: `'inbox'`). The existing `AgentService.getBuiltinAgent(slug)` returns a merged config object. If it does not expose the raw agent `id`, add a lightweight `agentModel.findBySlug(slug, userId)` query that returns just the ID. The service already has `serverDB` and `userId`.

### Upsert Load Policy

When calling `upsert()` for IDENTITY.md and SOUL.md, do NOT pass `loadPosition` or `loadRules` explicitly. The `upsert` merge logic preserves existing values when parameters are `undefined` (verified: `loadPosition || existingContext.position` in update path). This ensures template-initialized load policies are preserved.

## Edge Cases

- **Re-onboarding (reset):** `reset()` should call `agentDocumentModel.deleteByTemplate(inboxAgentId, 'claw')` then `initializeFromTemplate(inboxAgentId, 'claw')` to revert documents to defaults. Non-template documents (agent self-created) survive reset.
- **Inbox agent not yet initialized:** Check `agentDocumentModel.hasByAgent(inboxAgentId)` first. If false, call `initializeFromTemplate('claw')` before upserting. The subsequent upsert will overwrite the template defaults for IDENTITY.md/SOUL.md — this double-write is intentional and acceptable (idempotent upsert).
- **Partial onboarding:** User may abandon mid-flow. IDENTITY.md will exist (written at first node), SOUL.md will have partial profile sections. Acceptable — content reflects what was collected.
- **`state.agentIdentity` removal:** `state.agentIdentity` is separate from `state.profile`. If onboarding UI reads `state.agentIdentity` for display (e.g., showing agent name/emoji in summary screen), either: (a) keep writing to `state.agentIdentity` as well (dual write), or (b) update UI to read from the document. Recommend (a) for minimal UI disruption during this change.
