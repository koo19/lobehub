# Onboarding `saveUserQuestion` Simplification

**Date:** 2026-03-25
**Status:** Approved

## Problem

The current onboarding implementation still carries a strong step-machine model:

- `saveAnswer` is operationally constrained by `activeNode`
- batch updates are nominally supported but practically restricted by node-gating
- AI-facing tool results are delivered primarily as JSON payloads
- document updates and structured onboarding state overlap in responsibility

This creates unnecessary complexity in prompt design, runtime behavior, and test surface. The intended direction is to weaken the onboarding state model substantially and move long-lived identity/persona content to markdown documents handled explicitly by document tools.

## Design Goals

| Goal                                                    | Outcome                                                                        |
| ------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Remove strong node progression semantics                | No mandatory `activeNode` gating for `saveUserQuestion`                        |
| Preserve legacy structured fields still used elsewhere  | Keep only `fullName`, `interests`, and `responseLanguage` as structured writes |
| Make markdown documents the canonical long-lived memory | Agent identity and persona content are maintained through document tools only  |
| Improve AI ergonomics                                   | Tool `content` should be plain-language message text, not JSON-first           |
| Reduce code volume                                      | Delete draft/step-completion logic where it only serves the old state machine  |

## Scope Boundary

This specification builds on the already approved document split work:

- `SOUL.md` remains the canonical agent identity document
- `user_persona` remains the canonical user narrative document
- `readDocument` / `updateDocument` already exist and are not redesigned here

The scope of this document is limited to simplifying onboarding state, tool contracts, and prompt/runtime behavior around `saveUserQuestion`.

## Recommended Architecture

### Source of Truth Split

| Data Category          | Canonical Storage                     | Writer                            |
| ---------------------- | ------------------------------------- | --------------------------------- |
| Agent identity         | `SOUL.md`                             | `readDocument` / `updateDocument` |
| User persona narrative | `user_persona` document               | `readDocument` / `updateDocument` |
| `fullName`             | user structured state                 | `saveUserQuestion`                |
| `interests`            | user structured state                 | `saveUserQuestion`                |
| `responseLanguage`     | user settings                         | `saveUserQuestion`                |
| onboarding completion  | `finishedAt` and topic transfer state | `finishOnboarding`                |

### High-Level Flow

```text
User message
    |
    v
Agent calls getOnboardingState
    |
    v
Agent reads SOUL.md / user_persona as needed
    |
    v
Agent decides what information was learned
    |
    +-> saveUserQuestion(updates[])
    |      -> persist only fullName / interests / responseLanguage
    |
    +-> updateDocument(...)
           -> persist SOUL.md / user_persona changes
```

- `saveUserQuestion` no longer owns markdown writeback.
- Document tools become the only writers of onboarding markdown content.
- The onboarding service provides only minimal orchestration and completion state.

## Tool Surface

| Tool                  | Keep | Responsibility                                                                                 |
| --------------------- | ---- | ---------------------------------------------------------------------------------------------- |
| `getOnboardingState`  | Yes  | Return message-oriented onboarding summary plus minimal machine state                          |
| `saveUserQuestion`    | Yes  | Accept a simplified batch payload and persist only `fullName`, `interests`, `responseLanguage` |
| `readDocument`        | Yes  | Read `SOUL.md` / `user_persona`                                                                |
| `updateDocument`      | Yes  | Update `SOUL.md` / `user_persona`                                                              |
| `completeCurrentStep` | No   | Remove; no longer needed without strong node progression                                       |
| `returnToOnboarding`  | No   | Remove or reduce to pure prompt behavior                                                       |
| `finishOnboarding`    | Yes  | Finalize onboarding and transfer topic                                                         |

### API Naming Decision

| Current Name | New Name           | Decision                                                                   |
| ------------ | ------------------ | -------------------------------------------------------------------------- |
| `saveAnswer` | `saveUserQuestion` | Rename across manifest, types, server runtime, client executor, and router |

The new name is normative. This specification does not preserve `saveAnswer` as the long-term public tool name.

## `saveUserQuestion` Semantics

### Input Model

`saveUserQuestion` should replace the old node-scoped patch model with one flat payload:

```ts
interface SaveUserQuestionInput {
  fullName?: string;
  interests?: string[];
  responseLanguage?: string;
}
```

This flat payload is sufficient because only three structured fields remain in scope. “Batch update” now means submitting any combination of these fields in one tool call.

### Persistence Rules

| Input Content                 | Behavior                                                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------------------------- |
| `fullName`                    | Persist to user profile                                                                                 |
| `interests`                   | Persist to user profile                                                                                 |
| `responseLanguage`            | Persist to user settings                                                                                |
| unsupported onboarding fields | Do not persist structurally; these belong in markdown documents and should be handled by document tools |

### No-Op and Partial-Success Rules

| Case                                                       | Result                                                                                               |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| At least one supported field is present and valid          | `success: true`; persist supported fields                                                            |
| Unsupported fields are included alongside supported fields | `success: true`; supported fields are saved and unsupported fields are reported in `ignoredFields`   |
| No supported fields are present                            | `success: false`; return a plain-language message explaining that no structured fields were eligible |
| Supported field value is unchanged                         | `success: true`; report as unchanged or omit from `savedFields`                                      |

### Output Model

Tool `content` must be a natural-language message. Example shape:

| Field                 | Purpose                                                                 |
| --------------------- | ----------------------------------------------------------------------- |
| `content`             | Plain-language summary such as “Saved interests and response language.” |
| `state.savedFields`   | Minimal machine-readable list of saved structured fields                |
| `state.ignoredFields` | Optional list of fields intentionally not persisted structurally        |

JSON should not be the primary AI-visible representation.

## Onboarding State Simplification

### Fields to Remove or Weaken

| Field / Concept                   | Action                       | Reason                                                      |
| --------------------------------- | ---------------------------- | ----------------------------------------------------------- |
| `completedNodes`                  | Remove or derive temporarily | Strong step progression is no longer canonical              |
| `draft`                           | Remove                       | Draft persistence exists only for the old gated flow        |
| `activeNode` persistence          | Remove                       | If needed, compute advisory next-question hints dynamically |
| `control.allowedTools`            | Remove or drastically reduce | Tool eligibility should not depend on strict step state     |
| “complete current step” semantics | Remove                       | The agent now writes data and documents directly            |

### Fields to Keep

| Field           | Reason                                   |
| --------------- | ---------------------------------------- |
| `activeTopicId` | Maintain onboarding conversation linkage |
| `finishedAt`    | Completion gate and re-entry behavior    |
| `version`       | Migration compatibility                  |

The onboarding service may still derive an advisory “next useful question,” but that hint must not restore the old persisted step-machine model.

## `getOnboardingState` Contract

`getOnboardingState` should become advisory and message-oriented.

| Output                          | Description                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------- |
| `content`                       | Plain-language summary of what is already known and what is still useful to ask |
| `state.finished`                | Completion flag                                                                 |
| `state.topicId`                 | Current onboarding topic                                                        |
| `state.missingStructuredFields` | Subset of `fullName`, `interests`, `responseLanguage` still absent              |

It should not expose the old step-machine JSON context as the primary output.

## Prompt Changes

### System Prompt

The onboarding agent prompt should be rewritten to reflect:

- no single-node gate around `saveUserQuestion`
- batch updates are allowed
- markdown updates must be done explicitly through document tools
- structured persistence is limited to `fullName`, `interests`, and `responseLanguage`
- AI should consume message-oriented tool output rather than JSON dumps

### Tool System Prompt

The tool prompt should:

- remove statements such as “activeNode is the only step you may act on”
- remove step-completion instructions tied to `completeCurrentStep`
- describe `saveUserQuestion` as a thin structured persistence tool
- describe document tools as the only markdown persistence path

## UI and Store Consumer Migration

The codebase still contains consumers that derive onboarding progress from `completedNodes` and `activeNode`. These must be updated as part of the same implementation plan.

| Consumer Area                                        | Required Change                                                                        |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `src/store/user/slices/agentOnboarding/selectors.ts` | Remove `activeNode` derivation from `completedNodes`                                   |
| `src/features/Onboarding/Agent/context.ts`           | Stop reconstructing flow state from persisted node progression                         |
| `src/features/Onboarding/Agent/index.tsx`            | Ensure bootstrap logic tolerates minimal onboarding state                              |
| onboarding-related tests                             | Replace step-progression assertions with minimal-state and message-oriented assertions |

## Migration Scope

| File Area                                                           | Change                                                                                       |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `packages/types/src/user/agentOnboarding.ts`                        | Remove strong state-machine structures; keep minimal metadata and updated tool payload types |
| `packages/builtin-tool-web-onboarding/src/manifest.ts`              | Simplify APIs, schema descriptions, and tool text                                            |
| `packages/builtin-tool-web-onboarding/src/types.ts`                 | Update API enum and remove obsolete names                                                    |
| `src/server/services/onboarding/index.ts`                           | Replace node-progression logic with minimal persistence + completion service                 |
| `src/server/services/toolExecution/serverRuntimes/webOnboarding.ts` | Return message-first tool content                                                            |
| `src/services/user/index.ts`                                        | Update client contract                                                                       |
| `src/store/tool/slices/builtin/executors/lobe-web-onboarding.ts`    | Return message-first content; remove JSON-first behavior                                     |
| `src/server/routers/lambda/user.ts`                                 | Simplify mutation/query schema                                                               |
| `src/store/user/slices/agentOnboarding/selectors.ts`                | Remove selector assumptions tied to `completedNodes`                                         |
| `src/features/Onboarding/Agent/context.ts`                          | Simplify onboarding bootstrap context                                                        |
| `src/features/Onboarding/Agent/index.tsx`                           | Remove hard dependencies on strong onboarding state                                          |
| `packages/builtin-agent-onboarding/src/systemRole.ts`               | Rewrite behavioral instructions                                                              |
| `packages/builtin-agent-onboarding/src/toolSystemRole.ts`           | Rewrite tool-facing instructions                                                             |

## Verification Strategy

| Area                     | Verification                                                      |
| ------------------------ | ----------------------------------------------------------------- |
| Batch structured updates | `saveUserQuestion` persists multiple supported fields in one call |
| Field filtering          | Unsupported fields are ignored structurally and reported clearly  |
| Document responsibility  | Only document tools update markdown content                       |
| AI-visible output        | `content` is plain-language text, not JSON dumps                  |
| Completion               | `finishOnboarding` still marks completion and transfers the topic |

## Risks

| Risk                                  | Mitigation                                                                            |
| ------------------------------------- | ------------------------------------------------------------------------------------- |
| Loss of deterministic next-step flow  | Accept weaker orchestration and let prompts infer the next useful question            |
| UI assumptions about node progress    | Audit onboarding UI and convert any hard dependency into derived or optional behavior |
| Hidden dependencies on removed fields | Retain the minimal structured set required by legacy onboarding consumers             |

## Decision Summary

| Decision               | Result                                                |
| ---------------------- | ----------------------------------------------------- |
| State model            | Weaken substantially                                  |
| Markdown writes        | Document tools only                                   |
| Structured persistence | Keep only `fullName`, `interests`, `responseLanguage` |
| Batch updates          | Supported                                             |
| AI-facing output       | Message-first, not JSON-first                         |
| Old step-machine APIs  | Remove where no longer necessary                      |
