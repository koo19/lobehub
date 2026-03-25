# Onboarding → Inbox Integration Design

**Date:** 2026-03-24
**Status:** Approved
**Supersedes:** `2026-03-24-onboarding-agent-document-design.md` (document writing portions merged here)

## Problem

The onboarding flow currently operates under a separate `web-onboarding` builtin agent. Topics, messages, and agent documents are isolated from the inbox agent. After onboarding:

1. The conversation is invisible in inbox — users cannot revisit it
2. Agent identity/profile data is stored only in `user.agentOnboarding` state, not as durable agent documents (IDENTITY.md / SOUL.md)
3. Users must manually discover the inbox to start chatting

## Goals

1. Onboarding conversation topic appears in inbox after completion
2. Agent identity and user profile are written as IDENTITY.md / SOUL.md to the inbox agent progressively during onboarding
3. After completion, the topic becomes a normal inbox topic (inbox agent prompt, no structured questions)
4. Minimal changes to the existing onboarding flow

## Design Decisions

| Decision                   | Choice                                            | Rationale                                                                                                             |
| -------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Integration strategy       | Completion-time topic migration (approach B)      | No new abstractions, minimal in-flow changes, one-time atomic operation                                               |
| Document write timing      | Progressive during `commitActiveStep`             | Users who abandon mid-flow still get partial IDENTITY.md/SOUL.md in inbox                                             |
| Topic migration timing     | User-initiated via CTA button                     | Prevents mid-conversation state confusion; onboarding topic stays under web-onboarding until user explicitly finishes |
| CTA component              | Reuse QuestionRenderer                            | Consistent with existing onboarding interaction patterns                                                              |
| Post-completion navigation | Navigate to `/`                                   | Follows existing onboarding completion flow                                                                           |
| SOUL.md regeneration       | Always from CLAW template constant + profile data | Deterministic, no LLM overhead, no fragile content parsing                                                            |

## Architecture

### Overall Flow

```
[Onboarding in progress — agentId = web-onboarding]
[Prerequisite: ensure inbox agent documents initialized from CLAW template]

commitActiveStep('agentIdentity')
  → ensure inbox documents initialized (initializeFromTemplate if needed)
  → upsert inbox IDENTITY.md (name/vibe/emoji/nature)
  → upsert inbox SOUL.md (Core Truths + Boundaries + Vibe + Continuity)
  → state.agentIdentity dual-write (UI display)

commitActiveStep('userIdentity')
  → upsert inbox SOUL.md (fixed sections + "About My Human")

commitActiveStep('workStyle')
  → upsert inbox SOUL.md (+ "How We Work Together")

commitActiveStep('workContext')
  → upsert inbox SOUL.md (+ "Current Context")

commitActiveStep('painPoints')
  → upsert inbox SOUL.md (+ "Where I Can Help Most")

commitActiveStep('responseLanguage')
  → write user.settings.general.responseLanguage (no document write)

commitActiveStep('summary')
  → no document write (terminal node)

[User sees CTA: "完成 Onboarding"]
  → user clicks
  → finishOnboarding() (modified to include migration):
      transferToInbox() transaction:
        UPDATE topics SET agent_id = :inboxAgentId
          WHERE id = :topicId AND user_id = :userId
        UPDATE messages SET agent_id = :inboxAgentId
          WHERE topic_id = :topicId AND user_id = :userId
        UPDATE threads SET agent_id = :inboxAgentId
          WHERE topic_id = :topicId AND user_id = :userId
      mark onboarding finished (set finishedAt)
  → navigate to /

[Topic now in inbox — agentId = inbox, uses inbox prompt + IDENTITY.md/SOUL.md]
```

**Note on `topicId`:** The onboarding state stores `activeTopicId` (set during `ensureTopic`). The `finishOnboarding` method reads it from `state.activeTopicId` — no frontend trust boundary issue.

**Note on `finishOnboarding` integration:** `transferToInbox()` is called within the existing `finishOnboarding` method (not a separate endpoint). Migration is best-effort — `updateUser` and `transferToInbox` use different DB paths (UserModel vs raw Drizzle transaction) so they are not atomic. If transfer fails, onboarding is still marked finished and the topic stays under web-onboarding. This is acceptable degradation since IDENTITY.md/SOUL.md are already written to inbox during `commitActiveStep`.

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

Retains existing CLAW SOUL.md fixed sections. Profile sections appended progressively. Uses SYSTEM_APPEND, priority 1.

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
   - Inject `AgentDocumentsService` dependency
   - Add `getInboxAgentId()` helper — call `this.agentModel.getBuiltinAgent('inbox')` which returns `AgentItem | null` containing `.id` (use model layer directly, not `AgentService.getBuiltinAgent()` which returns a merged config object)
   - Cache `inboxAgentId` on the service instance to avoid repeated DB queries across `commitActiveStep` calls
   - Add `buildIdentityDocument(agentIdentity)` and `buildSoulDocument(state)` helpers
   - In `commitActiveStep('agentIdentity')`, ensure inbox documents initialized via `initializeFromTemplate('claw')` before first upsert
   - In `commitActiveStep`, after each relevant node commit, upsert IDENTITY.md/SOUL.md to inbox agent
   - Keep `state.agentIdentity` dual-write for UI display
   - Add `transferToInbox(topicId)` private method — single transaction updating topic, messages, threads agentId (all scoped by `userId`)
   - Integrate `transferToInbox()` into existing `finishOnboarding()` method (not a separate endpoint)

2. **`src/features/Onboarding/Agent/Conversation.tsx`**
   - After summary node, render CTA using QuestionRenderer (e.g., button "完成 Onboarding")
   - On click: call existing `finishOnboarding` endpoint (which now includes migration) → `navigate('/')`

3. **`packages/database/src/models/topic.ts`**
   - Add `transferToAgent(topicId, newAgentId)` method, or implement directly in OnboardingService via transactional raw queries

4. **`packages/database/src/models/agentDocuments/agentDocument.ts`**
   - Verify `upsert()` by filename works correctly when document already exists from template initialization

### New Helpers (in OnboardingService)

- `getInboxAgentId(): Promise<string>` — call `this.agentModel.getBuiltinAgent('inbox')` returning `AgentItem.id`. Cache result on service instance.
- `ensureInboxDocuments(inboxAgentId): Promise<void>` — check `agentDocumentModel.hasByAgent(inboxAgentId)`, if false call `initializeFromTemplate('claw')`. Called once before first document upsert.
- `buildIdentityDocument(agentIdentity): string` — render IDENTITY.md content
- `buildSoulDocument(state): string` — render SOUL.md from CLAW template + accumulated profile
- `transferToInbox(topicId): Promise<void>` — transaction: update topics, messages, threads agentId to inbox, all scoped by `AND user_id = :userId`

### Upsert Load Policy

Document upsert relies on `initializeFromTemplate('claw')` being called first (in `ensureInboxDocuments`). This ensures IDENTITY.md and SOUL.md rows exist with correct `loadPosition` and `loadRules` from the template. Subsequent `upsert()` calls update only `content` — do NOT pass `loadPosition` or `loadRules` explicitly, as the upsert merge logic preserves existing values when undefined.

If `initializeFromTemplate` has not been called (first-time onboarding), `upsert` would `create` with default `loadPosition = BEFORE_FIRST_USER`, which is incorrect for IDENTITY.md (should be `BEFORE_SYSTEM`). Hence the prerequisite check is mandatory, not optional.

### Unchanged

- Onboarding state machine, node flow, draft/questionSurface mechanics
- `state.profile` still written (used by onboarding UI for display)
- CLAW template definitions (remain as defaults for non-onboarded agents)
- Tool layer (`builtin-tool-agent-documents`) — no changes
- `AGENTS.md` document — untouched
- `web-onboarding` agent definition — retained for system prompt during onboarding

## Edge Cases

- **Mid-flow abandonment:** IDENTITY.md/SOUL.md partially written to inbox (reflects collected data). Topic remains under web-onboarding, invisible in inbox. User gets partial agent personality when using inbox directly.
- **Re-onboarding (reset):** Call `agentDocumentModel.deleteByTemplate(inboxAgentId, 'claw')` then `initializeFromTemplate(inboxAgentId, 'claw')` to revert documents. Previously migrated onboarding topic remains in inbox as a normal topic (preserving chat history). A new onboarding topic is created fresh under web-onboarding.
- **Inbox agent not yet initialized:** Handled by `ensureInboxDocuments()` prerequisite in `commitActiveStep('agentIdentity')` — not an edge case, part of the main flow.
- **Idempotent migration:** `transferToInbox()` checks `topic.agentId` — if already inbox, skip.
- **`state.agentIdentity` dual-write:** Keep writing to both state (for onboarding UI display) and IDENTITY.md document (for inbox agent context). Recommend keeping dual-write for minimal UI disruption.
- **SOUL.md separator:** The CLAW template `SOUL_DOCUMENT.content` contains a mid-content `---` separator followed by italicized text. `buildSoulDocument` appends `\n\n---\n\n` before profile sections. The resulting output (`...update it.\n\n---\n\n## About My Human`) reads correctly — the template's `---` is thematic, the appended `---` separates template from profile. No double-separator issue.
- **Transaction failure:** If `transferToInbox()` fails (e.g., inbox agent not found), the entire `finishOnboarding` transaction rolls back — onboarding state remains unfinished, topic stays under web-onboarding. Frontend receives error, user can retry.
