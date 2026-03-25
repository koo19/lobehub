# Onboarding Document & Persona Split

**Date:** 2026-03-25
**Status:** Approved

## Problem

The onboarding flow currently dumps all collected information into SOUL.md — both agent identity and user profile data. User-related information (work style, interests, pain points) belongs in `user_memory_persona_documents`, not in the agent's soul document. Additionally, document updates happen via server-side auto-sync at commit time rather than being driven by the agent, limiting the agent's ability to compose natural, contextual content.

## Design

### Content Responsibility Split

| Document         | Storage                         | Content                                                                                                  |
| ---------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **SOUL.md**      | `agent_documents` (inbox agent) | Agent identity (name, creature, vibe, emoji) + base template (core truths, boundaries, vibe, continuity) |
| **User Persona** | `user_memory_persona_documents` | User identity, work style, current context, interests, pain points                                       |

### Tool API

Two new APIs on `lobe-web-onboarding`, replacing the existing `readSoulDocument` / `updateSoulDocument`:

| API              | Parameters                                       | Behavior                                                                                                  |
| ---------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `readDocument`   | `{ type: 'soul' \| 'persona' }`                  | `soul` → read inbox agent's SOUL.md via `AgentDocumentsService`; `persona` → read from `UserPersonaModel` |
| `updateDocument` | `{ type: 'soul' \| 'persona', content: string }` | `soul` → upsert inbox agent's SOUL.md; `persona` → upsert `user_memory_persona_documents`                 |

Routing by `type` is handled inside the tool implementation (server runtime + client executor).

### Agent-Driven Updates (Remove Server-Side Auto-Sync)

Remove the automatic `upsertInboxDocuments` call from `OnboardingService.commitActiveStep`. Document and persona updates are fully driven by the agent via `readDocument` / `updateDocument` tool calls, guided by the system prompt.

### System Prompt Constraints

The onboarding agent's system prompt and tool system prompt are updated with:

```
Document management:
- After each profile node commit, call readDocument + updateDocument to persist changes.
- SOUL.md (type: "soul"): only agent identity (name, creature, vibe, emoji) + base template. No user info.
- User Persona (type: "persona"): user identity, work style, current context, interests, pain points.
- Both documents are mutable — read first, merge new info, write full updated content. Do not blindly append.
- Do not put user information into SOUL.md. Do not put agent identity into persona.
```

### Incremental Updates

The agent updates documents after each node commit, not in a batch at the end. Both SOUL.md and user persona are treated as mutable documents — the agent reads the current content, merges new information, and writes the full updated content. No append-only behavior.

## File Changes

| File                                                                | Action                                                                               |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `packages/builtin-tool-web-onboarding/src/types.ts`                 | Replace `readSoulDocument`/`updateSoulDocument` with `readDocument`/`updateDocument` |
| `packages/builtin-tool-web-onboarding/src/manifest.ts`              | Replace two API manifests, add `type` parameter                                      |
| `src/server/services/toolExecution/serverRuntimes/webOnboarding.ts` | Replace implementation, route by `type`                                              |
| `src/store/tool/slices/builtin/executors/lobe-web-onboarding.ts`    | Replace client executor methods                                                      |
| `src/services/user/index.ts`                                        | Replace service methods                                                              |
| `src/server/routers/lambda/user.ts`                                 | Replace TRPC routes                                                                  |
| `packages/builtin-agent-onboarding/src/systemRole.ts`               | Rewrite document management section                                                  |
| `packages/builtin-agent-onboarding/src/toolSystemRole.ts`           | Rewrite document management section                                                  |
| `src/server/services/onboarding/index.ts`                           | Remove `upsertInboxDocuments` call from `commitActiveStep`                           |
| `src/server/services/onboarding/documentHelpers.ts`                 | Remove `buildSoulDocument` user-info sections (may deprecate file)                   |
| `src/locales/default/plugin.ts`                                     | Replace i18n keys                                                                    |
| `locales/zh-CN/plugin.json`                                         | Replace i18n keys                                                                    |
