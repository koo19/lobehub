# Onboarding → Inbox Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate onboarding conversation topic to inbox on completion, and progressively write IDENTITY.md/SOUL.md to the inbox agent during onboarding.

**Architecture:** Onboarding flow runs under `web-onboarding` agent (unchanged). Each `commitActiveStep` upserts IDENTITY.md/SOUL.md to the inbox agent. On user-initiated completion (CTA button), `finishOnboarding` transfers the topic + messages + threads to inbox via a single transaction.

**Tech Stack:** TypeScript, Drizzle ORM (PostgreSQL), React, Zustand, Vitest

**Spec:** `docs/superpowers/specs/2026-03-24-onboarding-inbox-integration-design.md`

---

## File Structure

| File                                                     | Action | Responsibility                                                                                                                                                                                |
| -------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/server/services/onboarding/index.ts`                | Modify | Add `AgentDocumentsService` dep, `getInboxAgentId`, `ensureInboxDocuments`, `buildIdentityDocument`, `buildSoulDocument`, `transferToInbox`; modify `commitActiveStep` and `finishOnboarding` |
| `src/server/services/onboarding/documentHelpers.ts`      | Create | Pure functions: `buildIdentityDocument`, `buildSoulDocument` (testable without DB)                                                                                                            |
| `src/server/services/onboarding/documentHelpers.test.ts` | Create | Unit tests for document builders                                                                                                                                                              |
| `src/server/services/onboarding/index.test.ts`           | Modify | Add tests for `transferToInbox` and document upsert integration                                                                                                                               |
| `src/features/Onboarding/Agent/Conversation.tsx`         | Modify | Add CTA rendering after summary node                                                                                                                                                          |

---

### Task 1: Create document builder helpers

**Files:**

- Create: `src/server/services/onboarding/documentHelpers.ts`

- Create: `src/server/services/onboarding/documentHelpers.test.ts`

- Reference: `packages/database/src/models/agentDocuments/templates/claw/soul.ts` (SOUL_DOCUMENT constant)

- Reference: `packages/database/src/models/agentDocuments/templates/claw/identity.ts` (IDENTITY_DOCUMENT constant)

- [ ] **Step 1: Write failing tests for `buildIdentityDocument`**

```typescript
// src/server/services/onboarding/documentHelpers.test.ts
import { describe, expect, it } from 'vitest';

import { buildIdentityDocument, buildSoulDocument } from './documentHelpers';

describe('buildIdentityDocument', () => {
  it('should render all identity fields', () => {
    const result = buildIdentityDocument({
      emoji: '🦊',
      name: 'Fox',
      nature: 'digital familiar',
      vibe: 'warm and curious',
    });

    expect(result).toContain('**Name:** Fox');
    expect(result).toContain('**Creature:** digital familiar');
    expect(result).toContain('**Vibe:** warm and curious');
    expect(result).toContain('**Emoji:** 🦊');
  });

  it('should handle missing optional fields gracefully', () => {
    const result = buildIdentityDocument({
      emoji: '🤖',
      name: 'Bot',
      nature: '',
      vibe: '',
    });

    expect(result).toContain('**Name:** Bot');
    expect(result).toContain('**Emoji:** 🤖');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bunx vitest run --silent='passed-only' src/server/services/onboarding/documentHelpers.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write failing tests for `buildSoulDocument`**

Add to the same test file:

```typescript
describe('buildSoulDocument', () => {
  it('should return base SOUL content when no profile exists', () => {
    const result = buildSoulDocument({ version: 1 });

    expect(result).toContain('# SOUL.md - Who You Are');
    expect(result).toContain('## Core Truths');
    expect(result).not.toContain('## About My Human');
  });

  it('should append identity summary when present', () => {
    const result = buildSoulDocument({
      profile: {
        identity: { summary: 'A software engineer who loves Rust.' },
      },
      version: 1,
    });

    expect(result).toContain('## About My Human');
    expect(result).toContain('A software engineer who loves Rust.');
  });

  it('should append all profile sections progressively', () => {
    const result = buildSoulDocument({
      profile: {
        identity: { summary: 'Engineer' },
        painPoints: { summary: 'Too many meetings' },
        workContext: {
          activeProjects: ['ProjectA', 'ProjectB'],
          interests: ['AI'],
          summary: 'Working on chat app',
          tools: ['VS Code'],
        },
        workStyle: { summary: 'Direct and concise' },
      },
      version: 1,
    });

    expect(result).toContain('## About My Human');
    expect(result).toContain('## How We Work Together');
    expect(result).toContain('## Current Context');
    expect(result).toContain('- **Active Projects:** ProjectA, ProjectB');
    expect(result).toContain('- **Interests:** AI');
    expect(result).toContain('- **Tools:** VS Code');
    expect(result).toContain('## Where I Can Help Most');
  });

  it('should omit sections with empty summaries', () => {
    const result = buildSoulDocument({
      profile: {
        identity: { summary: '' },
        workStyle: { summary: 'Direct' },
      },
      version: 1,
    });

    expect(result).not.toContain('## About My Human');
    expect(result).toContain('## How We Work Together');
  });
});
```

- [ ] **Step 4: Implement `buildIdentityDocument` and `buildSoulDocument`**

```typescript
// src/server/services/onboarding/documentHelpers.ts
import type { UserAgentOnboarding } from '@lobechat/types';

import { SOUL_DOCUMENT } from '@/database/models/agentDocuments/templates/claw/soul';

interface AgentIdentityInput {
  emoji: string;
  name: string;
  nature: string;
  vibe: string;
}

export const buildIdentityDocument = (identity: AgentIdentityInput): string => {
  return [
    '# IDENTITY.md - Who Am I?',
    '',
    `- **Name:** ${identity.name}`,
    `- **Creature:** ${identity.nature}`,
    `- **Vibe:** ${identity.vibe}`,
    `- **Emoji:** ${identity.emoji}`,
  ].join('\n');
};

export const buildSoulDocument = (
  state: Pick<UserAgentOnboarding, 'profile' | 'version'>,
): string => {
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
    const lists: string[] = [];
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
};
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bunx vitest run --silent='passed-only' src/server/services/onboarding/documentHelpers.test.ts`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add src/server/services/onboarding/documentHelpers.ts src/server/services/onboarding/documentHelpers.test.ts
git commit -m "✨ feat(onboarding): add document builder helpers for IDENTITY.md and SOUL.md"
```

---

### Task 2: Add `AgentDocumentsService` dependency and inbox agent resolution to `OnboardingService`

**Files:**

- Modify: `src/server/services/onboarding/index.ts` (constructor at line 578, private fields at line 571-576)

- [ ] **Step 1: Add `AgentDocumentsService` import and private field**

At top of file, add import:

```typescript
import { AgentDocumentsService } from '@/server/services/agentDocuments';
```

Add private fields after line 576:

```typescript
private readonly agentDocumentsService: AgentDocumentsService;
private cachedInboxAgentId?: string;
```

In constructor (after line 586), add:

```typescript
this.agentDocumentsService = new AgentDocumentsService(db, userId);
```

- [ ] **Step 2: Add `getInboxAgentId` helper method**

Add after constructor:

```typescript
private getInboxAgentId = async (): Promise<string> => {
  if (this.cachedInboxAgentId) return this.cachedInboxAgentId;

  const agent = await this.agentService.getBuiltinAgent(BUILTIN_AGENT_SLUGS.inbox);
  if (!agent?.id) {
    throw new Error('Inbox agent not found');
  }

  this.cachedInboxAgentId = agent.id;
  return agent.id;
};
```

Note: `AgentService.getBuiltinAgent` calls `AgentModel.getBuiltinAgent(slug)` which returns `AgentItem | null`. `AgentItem` has field `id` (from Drizzle `$inferSelect` on `agents` table). The existing pattern in `getOrCreateState` (line 687) confirms: `builtinAgent.id`.

- [ ] **Step 3: Add `ensureInboxDocuments` helper method**

```typescript
private ensureInboxDocuments = async (inboxAgentId: string): Promise<void> => {
  const hasDocuments = await this.agentDocumentsService.agentDocumentModel
    ? true  // If no direct access, use initializeFromTemplate which is idempotent (upsert-based)
    : false;

  // initializeFromTemplate uses upsert internally, so it's safe to call even if docs exist
  await this.agentDocumentsService.initializeFromTemplate(inboxAgentId, 'claw');
};
```

Actually, since `initializeFromTemplate` uses `upsert` internally (which checks existence), it's inherently idempotent. Simplify to:

```typescript
private inboxDocumentsInitialized = false;

private ensureInboxDocuments = async (inboxAgentId: string): Promise<void> => {
  if (this.inboxDocumentsInitialized) return;
  await this.agentDocumentsService.initializeFromTemplate(inboxAgentId, 'claw');
  this.inboxDocumentsInitialized = true;
};
```

- [ ] **Step 4: Verify build passes**

Run: `bunx tsc --noEmit --project tsconfig.json 2>&1 | head -20`
Or run lint on the modified file only.

- [ ] **Step 5: Commit**

```bash
git add src/server/services/onboarding/index.ts
git commit -m "✨ feat(onboarding): add AgentDocumentsService dependency and inbox agent resolution"
```

---

### Task 3: Upsert IDENTITY.md and SOUL.md in `commitActiveStep`

**Files:**

- Modify: `src/server/services/onboarding/index.ts` (commitActiveStep at line 995)
- Reference: `src/server/services/onboarding/documentHelpers.ts`

The `commitActiveStep` method has a switch statement (lines 1001-1172). After each case's state mutation (before the shared post-commit logic at line 1174), add document upsert calls.

- [ ] **Step 1: Import document helpers**

At top of file:

```typescript
import { buildIdentityDocument, buildSoulDocument } from './documentHelpers';
```

Import template constants for loadPosition:

```typescript
import { IDENTITY_DOCUMENT } from '@/database/models/agentDocuments/templates/claw/identity';
import { SOUL_DOCUMENT } from '@/database/models/agentDocuments/templates/claw/soul';
import { DocumentLoadFormat } from '@/database/models/agentDocuments';
```

- [ ] **Step 2: Add private method `upsertInboxDocuments`**

This centralizes the document write logic called from `commitActiveStep`:

```typescript
private upsertInboxDocuments = async (
  state: UserAgentOnboarding,
  writeIdentity: boolean,
): Promise<void> => {
  const inboxAgentId = await this.getInboxAgentId();
  await this.ensureInboxDocuments(inboxAgentId);

  // After ensureInboxDocuments, IDENTITY.md and SOUL.md rows exist with correct
  // loadPosition/loadRules from the CLAW template. Only update content here —
  // do NOT pass loadPosition or loadRules, as upsert merge preserves existing values.

  if (writeIdentity && state.agentIdentity) {
    await this.agentDocumentsService.upsertDocument({
      agentId: inboxAgentId,
      content: buildIdentityDocument(state.agentIdentity),
      filename: IDENTITY_DOCUMENT.filename,
    });
  }

  await this.agentDocumentsService.upsertDocument({
    agentId: inboxAgentId,
    content: buildSoulDocument(state),
    filename: SOUL_DOCUMENT.filename,
  });
};
```

Note: `AgentDocumentsService` may not have a `upsertDocument(params)` method. Check `src/server/services/agentDocuments.ts`. If it only exposes `agentDocumentModel.upsert(agentId, filename, content, ...)`, either:

- Add a `upsertDocument(params: UpsertDocumentParams)` method to `AgentDocumentsService`, or
- Access the model directly: `(this.agentDocumentsService as any).agentDocumentModel.upsert(agentId, filename, content)`

The `UpsertDocumentParams` interface already exists at line 20-29 of `agentDocuments.ts` but is not yet used by a public method. Adding one is straightforward.

- [ ] **Step 3: Add document upsert calls after each relevant node in `commitActiveStep`**

After the switch statement's case handling and before the post-commit logic (line 1174), add conditional upsert:

```typescript
// After the switch block, before getNextNode (line 1174):
const documentNodes: UserAgentOnboardingNode[] = [
  'agentIdentity',
  'userIdentity',
  'workStyle',
  'workContext',
  'painPoints',
];

if (documentNodes.includes(activeNode)) {
  try {
    await this.upsertInboxDocuments(state, activeNode === 'agentIdentity');
  } catch (error) {
    // Log but don't fail the commit — documents are supplementary
    console.error('[OnboardingService] Failed to upsert inbox documents:', error);
  }
}
```

- [ ] **Step 4: Verify build passes**

Run: `bunx tsc --noEmit --project tsconfig.json 2>&1 | grep -i error | head -10`

- [ ] **Step 5: Commit**

```bash
git add src/server/services/onboarding/index.ts
git commit -m "✨ feat(onboarding): upsert IDENTITY.md and SOUL.md to inbox during commitActiveStep"
```

---

### Task 4: Add `transferToInbox` method and integrate into `finishOnboarding`

**Files:**

- Modify: `src/server/services/onboarding/index.ts` (finishOnboarding at line 1277)

- Reference: `packages/database/src/repositories/agentMigration/index.ts` (migration pattern)

- Reference: `packages/database/src/schemas/topic.ts` (topics, threads tables)

- Reference: `packages/database/src/schemas/message.ts` (messages table)

- [ ] **Step 1: Add schema imports for direct DB operations**

```typescript
import { topics, threads } from '@/database/schemas/topic';
import { messages } from '@/database/schemas/message';
import { and, eq } from 'drizzle-orm';
```

Check if `eq` and `and` are already imported in the file. If so, skip.

- [ ] **Step 2: Add `transferToInbox` method**

Following the pattern from `AgentMigrationRepo` (preserve `updatedAt` via column ref). Includes idempotent guard — skip if topic already belongs to inbox.

```typescript
private transferToInbox = async (topicId: string): Promise<void> => {
  const inboxAgentId = await this.getInboxAgentId();

  // Idempotent: check if topic is already under inbox agent
  const topic = await this.topicModel.findById(topicId);
  if (!topic || topic.agentId === inboxAgentId) return;

  await this.db.transaction(async (tx) => {
    // 1. Update topic agentId — preserve updatedAt to bypass $onUpdate trigger
    await tx
      .update(topics)
      .set({ agentId: inboxAgentId, updatedAt: topics.updatedAt })
      .where(
        and(
          eq(topics.id, topicId),
          eq(topics.userId, this.userId),
        ),
      );

    // 2. Update messages agentId
    await tx
      .update(messages)
      .set({ agentId: inboxAgentId, updatedAt: messages.updatedAt })
      .where(
        and(
          eq(messages.topicId, topicId),
          eq(messages.userId, this.userId),
        ),
      );

    // 3. Update threads agentId
    await tx
      .update(threads)
      .set({ agentId: inboxAgentId, updatedAt: threads.updatedAt })
      .where(
        and(
          eq(threads.topicId, topicId),
          eq(threads.userId, this.userId),
        ),
      );
  });
};
```

- [ ] **Step 3: Integrate `transferToInbox` into `finishOnboarding`**

Modify `finishOnboarding` (line 1277-1320). Insert `transferToInbox` call after state update, before return:

```typescript
finishOnboarding = async () => {
  const state = await this.ensurePersistedState();
  const activeNode = getActiveNode(state);

  if (activeNode !== 'summary') {
    // ... existing guard (unchanged)
  }

  const finishedAt = new Date().toISOString();

  await this.userModel.updateUser({
    agentOnboarding: {
      ...state,
      completedNodes: dedupeNodes([...(state.completedNodes ?? []), 'summary']),
      draft: {},
      finishedAt,
      version: CURRENT_ONBOARDING_VERSION,
    },
    onboarding: {
      currentStep: MAX_ONBOARDING_STEPS,
      finishedAt,
      version: CURRENT_ONBOARDING_VERSION,
    },
  });

  // Transfer onboarding topic to inbox agent (best-effort).
  // Not in the same transaction as updateUser because they use different DB paths
  // (UserModel vs raw Drizzle). If transfer fails, onboarding is still marked finished
  // and the topic stays under web-onboarding — acceptable degradation since documents
  // (IDENTITY.md/SOUL.md) are already written to inbox during commitActiveStep.
  const topicId = state.activeTopicId;
  if (topicId) {
    try {
      await this.transferToInbox(topicId);
    } catch (error) {
      console.error('[OnboardingService] Failed to transfer topic to inbox:', error);
    }
  }

  return {
    content: 'Agent onboarding completed successfully.',
    finishedAt,
    success: true,
  };
};
```

- [ ] **Step 4: Verify build passes**

Run: `bunx tsc --noEmit --project tsconfig.json 2>&1 | grep -i error | head -10`

- [ ] **Step 5: Commit**

```bash
git add src/server/services/onboarding/index.ts
git commit -m "✨ feat(onboarding): transfer topic to inbox on finishOnboarding"
```

---

### Task 5: Add CTA button for completing onboarding

**Files:**

- Modify: `src/features/Onboarding/Agent/Conversation.tsx`
- Reference: `src/features/Onboarding/Agent/QuestionRenderer.tsx` (component interface)
- Reference: `src/features/Onboarding/Agent/questionRendererRuntime.tsx` (runtime props)

The CTA should appear after the summary node completes, as a `button_group` question rendered via `QuestionRenderer`.

- [ ] **Step 1: Read current Conversation.tsx rendering logic**

Read `src/features/Onboarding/Agent/Conversation.tsx` fully to understand where to insert the CTA. The summary node is the last step. After all nodes are completed (`activeNode === undefined` and `finishedAt` is not set, or `activeNode === 'summary'`), render the CTA.

- [ ] **Step 2: Add CTA rendering logic**

The exact implementation depends on the current rendering flow. The CTA should be a question-like element using `QuestionRenderer` with `mode: 'button_group'` and a single choice like "Complete Onboarding" / "完成设置".

When clicked, it should:

1. Call `userService.finishOnboarding()` (or the relevant TRPC endpoint)
2. Navigate to `/`

Check how the existing `onSendMessage` runtime prop works — the CTA click may need to trigger a different action than `sendMessage`. If `QuestionRenderer`'s `button_group` mode calls `onSendMessage(choiceValue)`, you may need to intercept this at the conversation level.

Alternative: render a standalone button (not QuestionRenderer) styled consistently with the onboarding UI. This avoids coupling with the message-sending flow.

- [ ] **Step 3: Implement the CTA**

If using a standalone button approach:

```tsx
// Inside the conversation render, when activeNode is summary and summary is about to complete:
{
  showCompletionCTA && (
    <CompletionCTA
      onComplete={async () => {
        await userService.finishOnboarding();
        await refreshUserState();
        navigate('/');
      }}
    />
  );
}
```

If using QuestionRenderer:

```tsx
const completionQuestion: UserAgentOnboardingQuestion = {
  choices: [{ label: t('onboarding.complete'), value: 'complete' }],
  mode: 'button_group',
  node: 'summary',
};
```

The exact approach depends on the existing patterns in Conversation.tsx. Follow whichever pattern is most consistent.

- [ ] **Step 4: Verify the UI renders correctly**

Run: `bun run dev:spa` and navigate to the onboarding flow to visually verify the CTA appears at the right time.

- [ ] **Step 5: Commit**

```bash
git add src/features/Onboarding/Agent/Conversation.tsx
git commit -m "✨ feat(onboarding): add completion CTA button that triggers inbox migration"
```

---

### Task 6: Update `reset` to handle previously migrated topics

**Files:**

- Modify: `src/server/services/onboarding/index.ts` (reset at line 1322)

- [ ] **Step 1: Modify `reset` to reinitialize inbox documents**

```typescript
reset = async () => {
  const state = defaultAgentOnboardingState();

  await this.userModel.updateUser({ agentOnboarding: state });

  // Reset only CLAW template documents on inbox agent — preserves user-created documents
  try {
    const inboxAgentId = await this.getInboxAgentId();
    await this.agentDocumentsService.deleteTemplateDocuments(inboxAgentId, 'claw');
    await this.agentDocumentsService.initializeFromTemplate(inboxAgentId, 'claw');
  } catch {
    // Inbox agent may not exist yet — ignore
  }

  return state;
};
```

Uses `deleteTemplateDocuments` (soft-delete by templateId) + `initializeFromTemplate` instead of `switchTemplate(false)` which would delete ALL documents including user-created ones.

- [ ] **Step 2: Verify build passes**

Run: `bunx tsc --noEmit --project tsconfig.json 2>&1 | grep -i error | head -10`

- [ ] **Step 3: Commit**

```bash
git add src/server/services/onboarding/index.ts
git commit -m "✨ feat(onboarding): reset inbox documents on re-onboarding"
```

---

### Task 7: Integration tests

**Files:**

- Modify: `src/server/services/onboarding/index.test.ts` (if exists, otherwise create)

- [ ] **Step 1: Check if test file exists**

Run: `ls src/server/services/onboarding/index.test.ts 2>/dev/null || echo "not found"`

- [ ] **Step 2: Write integration tests**

Key scenarios to test:

1. `commitActiveStep('agentIdentity')` upserts IDENTITY.md and SOUL.md to inbox agent
2. `commitActiveStep('userIdentity')` upserts SOUL.md with accumulated profile
3. `finishOnboarding()` calls `transferToInbox` and updates topic/messages agentId
4. `finishOnboarding()` is idempotent (second call doesn't error)
5. `reset()` reinitializes inbox documents

The exact test setup depends on existing test patterns in this file. Use `vi.spyOn` to mock `AgentDocumentsService` methods and verify calls.

- [ ] **Step 3: Run tests**

Run: `bunx vitest run --silent='passed-only' src/server/services/onboarding/`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add src/server/services/onboarding/
git commit -m "✅ test(onboarding): add integration tests for inbox document upsert and topic transfer"
```

---

### Task 8: Lint and type-check modified files

- [ ] **Step 1: Run type-check**

Run: `bunx tsc --noEmit --project tsconfig.json 2>&1 | grep -E 'src/server/services/onboarding|src/features/Onboarding' | head -20`

- [ ] **Step 2: Run lint on modified files**

Run: `bunx eslint src/server/services/onboarding/index.ts src/server/services/onboarding/documentHelpers.ts src/features/Onboarding/Agent/Conversation.tsx --fix`

- [ ] **Step 3: Fix any issues and commit**

```bash
git add -u
git commit -m "🔧 chore: fix lint and type-check issues"
```
