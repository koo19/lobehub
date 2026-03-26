# Onboarding `saveUserQuestion` Simplification Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify onboarding by replacing the node-gated `saveAnswer` flow with a flat `saveUserQuestion` tool, keeping only `fullName`, `interests`, and `responseLanguage` as structured persistence while leaving markdown ownership to document tools.

**Architecture:** Collapse the current onboarding step machine into a minimal service that tracks only conversation linkage and completion metadata. Rename the public tool API to `saveUserQuestion`, change its request contract to a flat payload, return message-first tool responses, and remove UI/store assumptions that onboarding progress is represented by persisted `completedNodes`, `draft`, or `activeNode`.

**Tech Stack:** TypeScript, Zod, TRPC, builtin tool manifests, server tool runtimes, Zustand, React, Vitest

**Spec Basis:** [docs/superpowers/specs/2026-03-25-onboarding-save-user-question-simplification-design.md](/Users/innei/git/work/lobe-chat/docs/superpowers/specs/2026-03-25-onboarding-save-user-question-simplification-design.md)

**Implementation skills:** @typescript, @testing, @react, @zustand

---

## File Structure

| File                                                                  | Action | Responsibility                                                                                                               |
| --------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `packages/types/src/user/agentOnboarding.ts`                          | Modify | Replace node-scoped onboarding payload/state types with the flat `saveUserQuestion` contract and minimal onboarding metadata |
| `packages/types/src/user/agentOnboarding.test.ts`                     | Create | Isolate schema and type-contract tests for the flattened onboarding payload                                                  |
| `packages/builtin-tool-web-onboarding/src/types.ts`                   | Modify | Rename `saveAnswer` to `saveUserQuestion`; remove obsolete API names                                                         |
| `packages/builtin-tool-web-onboarding/src/manifest.ts`                | Modify | Publish the simplified tool surface and flat schema                                                                          |
| `packages/builtin-agent-onboarding/src/systemRole.ts`                 | Modify | Remove active-node rules and describe document-tool ownership plus message-first tool usage                                  |
| `packages/builtin-agent-onboarding/src/toolSystemRole.ts`             | Modify | Mirror the simplified tool semantics for tool-only prompt execution                                                          |
| `packages/builtin-agent-onboarding/src/systemRole.test.ts`            | Create | Assert the onboarding prompts no longer encode the removed step-machine rules                                                |
| `src/server/services/onboarding/index.ts`                             | Modify | Remove draft/step-machine persistence, implement minimal `getState`, `saveUserQuestion`, and `finishOnboarding` behavior     |
| `src/server/routers/lambda/user.ts`                                   | Modify | Rename the onboarding mutation and expose the flat TRPC input schema                                                         |
| `src/server/services/toolExecution/serverRuntimes/webOnboarding.ts`   | Modify | Route the renamed API and return message-first runtime output                                                                |
| `src/services/user/index.ts`                                          | Modify | Rename client service methods and update the request/response types                                                          |
| `src/store/tool/slices/builtin/executors/lobe-web-onboarding.ts`      | Modify | Call the renamed API and stop emitting JSON-first tool content                                                               |
| `src/utils/webOnboardingToolResult.ts`                                | Modify | Produce plain-language `content` while retaining minimal machine-readable `state`                                            |
| `src/utils/webOnboardingToolResult.test.ts`                           | Create | Verify onboarding tool result serialization is message-first rather than JSON-first                                          |
| `src/store/user/slices/agentOnboarding/selectors.ts`                  | Modify | Remove `activeNode` derivation from persisted onboarding state                                                               |
| `src/features/Onboarding/Agent/context.ts`                            | Modify | Stop reconstructing UI state from `completedNodes` and `activeNode`                                                          |
| `src/features/Onboarding/Agent/index.tsx`                             | Modify | Tolerate minimal onboarding state during bootstrap and reset                                                                 |
| `src/server/services/onboarding/index.test.ts`                        | Modify | Replace step-machine assertions with flat structured persistence and completion assertions                                   |
| `src/store/tool/slices/builtin/executors/lobe-web-onboarding.test.ts` | Modify | Assert renamed API behavior and message-first responses                                                                      |
| `src/features/Onboarding/Agent/context.test.ts`                       | Modify | Verify bootstrap works without persisted node progression                                                                    |
| `src/features/Onboarding/Agent/index.test.tsx`                        | Create | Verify the onboarding page boots with minimal onboarding metadata and no `activeNode`                                        |

---

## Chunk 1: Contract Simplification

### Task 1: Shrink onboarding types to the minimal structured contract

**Files:**

- Modify: `packages/types/src/user/agentOnboarding.ts`

- Create: `packages/types/src/user/agentOnboarding.test.ts`

- [ ] **Step 1: Write the failing type-level and schema tests**

```typescript
// packages/types/src/user/agentOnboarding.test.ts
import { describe, expect, it } from 'vitest';

import { SaveUserQuestionInputSchema } from './agentOnboarding';

describe('SaveUserQuestionInputSchema', () => {
  it('accepts the flat structured payload', () => {
    const parsed = SaveUserQuestionInputSchema.parse({
      fullName: 'Ada Lovelace',
      interests: ['AI tooling'],
      responseLanguage: 'en-US',
    });

    expect(parsed).toEqual({
      fullName: 'Ada Lovelace',
      interests: ['AI tooling'],
      responseLanguage: 'en-US',
    });
  });

  it('rejects the old node-scoped payload', () => {
    expect(() => SaveUserQuestionInputSchema.parse({ updates: [] })).toThrow();
  });
});
```

- [ ] **Step 2: Run the targeted test file to confirm failure**

Run: `bunx vitest run --silent='passed-only' 'packages/types/src/user/agentOnboarding.test.ts'`
Expected: FAIL with missing `SaveUserQuestionInputSchema` or incompatible onboarding type errors

- [ ] **Step 3: Replace the old node-scoped contract with a flat payload and minimal state**

```typescript
export interface SaveUserQuestionInput {
  fullName?: string;
  interests?: string[];
  responseLanguage?: string;
}

export interface UserAgentOnboardingContext {
  finished: boolean;
  missingStructuredFields: Array<'fullName' | 'interests' | 'responseLanguage'>;
  topicId?: string;
  version: number;
}

export interface UserAgentOnboarding {
  activeTopicId?: string;
  finishedAt?: string;
  version: number;
}

export const SaveUserQuestionInputSchema = z.object({
  fullName: z.string().trim().min(1).optional(),
  interests: z.array(z.string().trim().min(1)).optional(),
  responseLanguage: z.string().trim().min(1).optional(),
});
```

- [ ] **Step 4: Run the targeted tests to confirm the new contract compiles and passes**

Run: `bunx vitest run --silent='passed-only' 'packages/types/src/user/agentOnboarding.test.ts'`
Expected: PASS

- [ ] **Step 5: Commit the isolated contract change**

```bash
git add packages/types/src/user/agentOnboarding.ts packages/types/src/user/agentOnboarding.test.ts
git commit -m "♻️ refactor(onboarding): flatten saveUserQuestion contract"
```

### Task 2: Rename the public onboarding tool API and simplify its manifest

**Files:**

- Modify: `packages/builtin-tool-web-onboarding/src/types.ts`

- Modify: `packages/builtin-tool-web-onboarding/src/manifest.ts`

- [ ] **Step 1: Add failing assertions for the renamed API surface**

```typescript
// src/store/tool/slices/builtin/executors/lobe-web-onboarding.test.ts
expect(WebOnboardingApiName.saveUserQuestion).toBe('saveUserQuestion');
expect('saveAnswer' in WebOnboardingApiName).toBe(false);
```

- [ ] **Step 2: Run the executor test to verify failure**

Run: `bunx vitest run --silent='passed-only' 'src/store/tool/slices/builtin/executors/lobe-web-onboarding.test.ts'`
Expected: FAIL with missing `saveUserQuestion` or outdated manifest expectations

- [ ] **Step 3: Rename the API enum and flatten the manifest parameters**

```typescript
export const WebOnboardingApiName = {
  finishOnboarding: 'finishOnboarding',
  getOnboardingState: 'getOnboardingState',
  readDocument: 'readDocument',
  saveUserQuestion: 'saveUserQuestion',
  updateDocument: 'updateDocument',
} as const;
```

```typescript
{
  name: WebOnboardingApiName.saveUserQuestion,
  description:
    'Persist structured onboarding fields that still belong in user state. Use this only for fullName, interests, and responseLanguage.',
  parameters: {
    properties: {
      fullName: { type: 'string' },
      interests: { items: { type: 'string' }, type: 'array' },
      responseLanguage: { type: 'string' },
    },
    type: 'object',
  },
}
```

- [ ] **Step 4: Re-run the executor test to confirm the renamed surface passes**

Run: `bunx vitest run --silent='passed-only' 'src/store/tool/slices/builtin/executors/lobe-web-onboarding.test.ts'`
Expected: PASS for the enum/manifest assertions added in this task

- [ ] **Step 5: Commit the tool contract rename**

```bash
git add packages/builtin-tool-web-onboarding/src/types.ts packages/builtin-tool-web-onboarding/src/manifest.ts src/store/tool/slices/builtin/executors/lobe-web-onboarding.test.ts
git commit -m "♻️ refactor(onboarding): rename saveAnswer to saveUserQuestion"
```

### Task 3: Rewrite onboarding prompts to reflect the simplified model

**Files:**

- Modify: `packages/builtin-agent-onboarding/src/systemRole.ts`

- Modify: `packages/builtin-agent-onboarding/src/toolSystemRole.ts`

- Create: `packages/builtin-agent-onboarding/src/systemRole.test.ts`

- [ ] **Step 1: Add failing prompt assertions**

```typescript
import { describe, expect, it } from 'vitest';

import { createSystemRole } from './systemRole';
import { toolSystemPrompt } from './toolSystemRole';

describe('onboarding prompts', () => {
  it('removes step-machine guidance', () => {
    const systemRole = createSystemRole('en-US');
    expect(systemRole).not.toContain('activeNode is the only step you may act on');
    expect(systemRole).toContain(
      'Use saveUserQuestion only for fullName, interests, and responseLanguage',
    );
    expect(toolSystemPrompt).not.toContain('completeCurrentStep');
    expect(toolSystemPrompt).toContain('Document tools are the only markdown persistence path');
  });
});
```

- [ ] **Step 2: Run the impacted onboarding tests to verify failure**

Run: `bunx vitest run --silent='passed-only' 'packages/builtin-agent-onboarding/src/systemRole.test.ts'`
Expected: FAIL with outdated prompt content

- [ ] **Step 3: Replace step-machine instructions with document-first guidance**

```typescript
Operational rules:
1. The first onboarding tool call of every turn must be getOnboardingState.
2. Use saveUserQuestion only for fullName, interests, and responseLanguage.
3. Use readDocument and updateDocument for all markdown-based identity and persona persistence.
4. Do not rely on activeNode, completedNodes, or draft-style progression.
5. Treat tool content as natural-language feedback rather than JSON state dumps.
```

- [ ] **Step 4: Re-run the onboarding tests to confirm the prompt files are aligned**

Run: `bunx vitest run --silent='passed-only' 'packages/builtin-agent-onboarding/src/systemRole.test.ts'`
Expected: PASS

- [ ] **Step 5: Commit the prompt rewrite**

```bash
git add packages/builtin-agent-onboarding/src/systemRole.ts packages/builtin-agent-onboarding/src/toolSystemRole.ts packages/builtin-agent-onboarding/src/systemRole.test.ts
git commit -m "♻️ refactor(onboarding): simplify onboarding prompts"
```

---

## Chunk 2: Service And Runtime Rewrite

### Task 4: Replace the onboarding service with minimal structured persistence

**Files:**

- Modify: `src/server/services/onboarding/index.ts`

- Modify: `src/server/services/onboarding/index.test.ts`

- [ ] **Step 1: Write failing server tests for flat persistence and missing-field summaries**

```typescript
it('persists fullName, interests, and responseLanguage from saveUserQuestion', async () => {
  const result = await service.saveUserQuestion({
    fullName: 'Ada Lovelace',
    interests: ['AI tooling'],
    responseLanguage: 'en-US',
  });

  expect(result.success).toBe(true);
  expect(result.savedFields).toEqual(['fullName', 'interests', 'responseLanguage']);
  expect(persistedUserState.fullName).toBe('Ada Lovelace');
  expect(persistedUserState.interests).toEqual(['AI tooling']);
  expect(persistedUserState.settings.general.responseLanguage).toBe('en-US');
});

it('returns a message-first onboarding summary', async () => {
  const context = await service.getState();
  expect(context.missingStructuredFields).toContain('interests');
});

it('rejects saveUserQuestion when no structured fields are provided', async () => {
  const result = await service.saveUserQuestion({});
  expect(result.success).toBe(false);
  expect(result.content).toContain('No supported structured fields');
});
```

- [ ] **Step 2: Run the onboarding service test file to confirm failure**

Run: `bunx vitest run --silent='passed-only' 'src/server/services/onboarding/index.test.ts'`
Expected: FAIL with missing `saveUserQuestion` method, outdated context shape, and old step-machine expectations

- [ ] **Step 3: Remove draft/step-machine persistence and implement the minimal service**

```typescript
getState = async (): Promise<UserAgentOnboardingContext> => {
  const userState = await this.getUserState();
  const state = this.ensureState(userState.agentOnboarding);

  const missingStructuredFields = [
    !userState.fullName ? 'fullName' : undefined,
    !userState.interests?.length ? 'interests' : undefined,
    !userState.settings?.general?.responseLanguage ? 'responseLanguage' : undefined,
  ].filter(Boolean) as UserAgentOnboardingContext['missingStructuredFields'];

  return {
    finished: !!state.finishedAt,
    missingStructuredFields,
    topicId: state.activeTopicId,
    version: state.version,
  };
};

saveUserQuestion = async (input: SaveUserQuestionInput) => {
  const savedFields: string[] = [];

  if (input.fullName) {
    await this.userModel.updateUser({ fullName: input.fullName });
    savedFields.push('fullName');
  }

  if (input.interests?.length) {
    await this.userModel.updateUser({ interests: input.interests });
    savedFields.push('interests');
  }

  if (input.responseLanguage) {
    const currentSettings = await this.userModel.getUserSettings();
    await this.userModel.updateSetting({
      general: merge(currentSettings?.general || {}, {
        responseLanguage: input.responseLanguage,
      }),
    });
    savedFields.push('responseLanguage');
  }

  if (savedFields.length === 0) {
    return {
      content:
        'No supported structured fields were provided. Use document tools for markdown-based onboarding content.',
      ignoredFields: [],
      savedFields,
      success: false,
    };
  }

  return {
    content: `Saved ${savedFields.join(', ')}.`,
    savedFields,
    success: true,
  };
};
```

- [ ] **Step 4: Re-run the onboarding service tests and ensure they pass**

Run: `bunx vitest run --silent='passed-only' 'src/server/services/onboarding/index.test.ts'`
Expected: PASS

- [ ] **Step 5: Commit the server service rewrite**

```bash
git add src/server/services/onboarding/index.ts src/server/services/onboarding/index.test.ts
git commit -m "♻️ refactor(onboarding): simplify onboarding service state"
```

### Task 5: Update TRPC, user service, runtime, and executor wiring for the renamed method

**Files:**

- Modify: `src/server/routers/lambda/user.ts`

- Modify: `src/services/user/index.ts`

- Modify: `src/server/services/toolExecution/serverRuntimes/webOnboarding.ts`

- Modify: `src/store/tool/slices/builtin/executors/lobe-web-onboarding.ts`

- Modify: `src/store/tool/slices/builtin/executors/lobe-web-onboarding.test.ts`

- [ ] **Step 1: Add failing integration tests for the renamed method path**

```typescript
vi.mocked(userService.saveUserQuestion).mockResolvedValue({
  content: 'Saved interests.',
  savedFields: ['interests'],
  success: true,
} as any);

await webOnboardingExecutor.saveUserQuestion({ interests: ['AI tooling'] }, {} as any);

expect(userService.saveUserQuestion).toHaveBeenCalledWith({
  interests: ['AI tooling'],
});
```

- [ ] **Step 2: Run the executor test file to verify failure**

Run: `bunx vitest run --silent='passed-only' 'src/store/tool/slices/builtin/executors/lobe-web-onboarding.test.ts'`
Expected: FAIL with missing `saveUserQuestion` method or outdated mocks

- [ ] **Step 3: Rename the wiring end-to-end**

```typescript
// src/server/routers/lambda/user.ts
saveUserQuestion: userProcedure
  .input(SaveUserQuestionInputSchema)
  .mutation(async ({ ctx, input }) => {
    const onboardingService = new OnboardingService(ctx.serverDB, ctx.userId);
    return onboardingService.saveUserQuestion(input);
  }),
```

```typescript
// src/services/user/index.ts
saveUserQuestion = async (params: SaveUserQuestionInput) => {
  return lambdaClient.user.saveUserQuestion.mutate(params);
};
```

```typescript
// src/store/tool/slices/builtin/executors/lobe-web-onboarding.ts
saveUserQuestion = async (params: SaveUserQuestionInput) => {
  const result = await userService.saveUserQuestion(params);
  await syncUserOnboardingState();
  return createWebOnboardingToolResult(result);
};
```

- [ ] **Step 4: Re-run the executor test file and related runtime tests**

Run: `bunx vitest run --silent='passed-only' 'src/store/tool/slices/builtin/executors/lobe-web-onboarding.test.ts' 'src/server/services/onboarding/index.test.ts'`
Expected: PASS

- [ ] **Step 5: Commit the renamed wiring**

```bash
git add src/server/routers/lambda/user.ts src/services/user/index.ts src/server/services/toolExecution/serverRuntimes/webOnboarding.ts src/store/tool/slices/builtin/executors/lobe-web-onboarding.ts src/store/tool/slices/builtin/executors/lobe-web-onboarding.test.ts
git commit -m "♻️ refactor(onboarding): wire saveUserQuestion end to end"
```

### Task 6: Replace JSON-first onboarding tool output with message-first results

**Files:**

- Modify: `src/utils/webOnboardingToolResult.ts`

- Modify: `src/server/services/toolExecution/serverRuntimes/webOnboarding.ts`

- Modify: `src/store/tool/slices/builtin/executors/lobe-web-onboarding.ts`

- Create: `src/utils/webOnboardingToolResult.test.ts`

- [ ] **Step 1: Add failing assertions for plain-language tool content**

```typescript
// src/utils/webOnboardingToolResult.test.ts
import { describe, expect, it } from 'vitest';

import { createWebOnboardingToolResult } from './webOnboardingToolResult';

describe('createWebOnboardingToolResult', () => {
  it('keeps onboarding tool content message-first', () => {
    const result = createWebOnboardingToolResult({
      content: 'Saved interests and response language.',
      savedFields: ['interests', 'responseLanguage'],
      success: true,
    });

    expect(result.content).toBe('Saved interests and response language.');
    expect(result.state.success).toBe(true);
    expect(result.content.trim().startsWith('{')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the impacted test file to confirm failure**

Run: `bunx vitest run --silent='passed-only' 'src/utils/webOnboardingToolResult.test.ts'`
Expected: FAIL because the helper still JSON-stringifies the payload

- [ ] **Step 3: Make the helper message-first and preserve only minimal `state`**

```typescript
export const createWebOnboardingToolResult = <T extends WebOnboardingToolActionResult>(
  result: T,
) => {
  const isError = !result.success;
  const errorMessage = result.error?.message || (isError ? result.content : undefined);

  return {
    content: result.content || (isError ? 'Web onboarding tool call failed.' : 'OK'),
    ...(errorMessage
      ? { error: { body: result, message: errorMessage, type: 'WebOnboardingToolError' } }
      : {}),
    state: {
      ...(result.savedFields ? { savedFields: result.savedFields } : {}),
      ...(result.ignoredFields ? { ignoredFields: result.ignoredFields } : {}),
      success: result.success,
    },
    success: result.success,
  };
};
```

- [ ] **Step 4: Re-run the executor test file to confirm message-first behavior**

Run: `bunx vitest run --silent='passed-only' 'src/utils/webOnboardingToolResult.test.ts' 'src/store/tool/slices/builtin/executors/lobe-web-onboarding.test.ts'`
Expected: PASS

- [ ] **Step 5: Commit the tool-result cleanup**

```bash
git add src/utils/webOnboardingToolResult.ts src/utils/webOnboardingToolResult.test.ts src/server/services/toolExecution/serverRuntimes/webOnboarding.ts src/store/tool/slices/builtin/executors/lobe-web-onboarding.ts src/store/tool/slices/builtin/executors/lobe-web-onboarding.test.ts
git commit -m "♻️ refactor(onboarding): return message-first tool results"
```

---

## Chunk 3: UI Consumer Migration And Final Verification

### Task 7: Remove selector and bootstrap dependencies on node progression

**Files:**

- Modify: `src/store/user/slices/agentOnboarding/selectors.ts`

- Modify: `src/features/Onboarding/Agent/context.ts`

- Modify: `src/features/Onboarding/Agent/context.test.ts`

- [ ] **Step 1: Add failing UI-state tests for minimal onboarding state**

```typescript
expect(
  resolveAgentOnboardingContext({
    storedAgentOnboarding: {
      activeTopicId: 'topic-1',
      version: CURRENT_ONBOARDING_VERSION,
    },
  }),
).toEqual({
  topicId: 'topic-1',
});

expect(
  agentOnboardingSelectors.isFinished({
    agentOnboarding: { finishedAt: '2026-03-25T00:00:00.000Z' },
  } as any),
).toBe(true);
```

- [ ] **Step 2: Run the context test file to verify failure**

Run: `bunx vitest run --silent='passed-only' 'src/features/Onboarding/Agent/context.test.ts'`
Expected: FAIL because the context still derives `activeNode` from `completedNodes`

- [ ] **Step 3: Remove `activeNode` derivation from persisted onboarding state**

```typescript
// src/store/user/slices/agentOnboarding/selectors.ts
const finishedAt = (s: UserStore) => s.agentOnboarding?.finishedAt;
const isFinished = (s: Pick<UserStore, 'agentOnboarding'>) => !!s.agentOnboarding?.finishedAt;

export const agentOnboardingSelectors = {
  finishedAt,
  isFinished,
  needsOnboarding,
};
```

```typescript
// src/features/Onboarding/Agent/context.ts
export const resolveAgentOnboardingContext = ({
  bootstrapContext,
  storedAgentOnboarding,
}: ResolveAgentOnboardingContextParams) => {
  return {
    topicId: bootstrapContext?.topicId ?? storedAgentOnboarding?.activeTopicId,
  };
};
```

- [ ] **Step 4: Re-run the context tests to confirm the simplified bootstrap behavior**

Run: `bunx vitest run --silent='passed-only' 'src/features/Onboarding/Agent/context.test.ts'`
Expected: PASS

- [ ] **Step 5: Commit the selector/bootstrap cleanup**

```bash
git add src/store/user/slices/agentOnboarding/selectors.ts src/features/Onboarding/Agent/context.ts src/features/Onboarding/Agent/context.test.ts
git commit -m "♻️ refactor(onboarding): remove node-progress selectors"
```

### Task 8: Make the onboarding page tolerate minimal bootstrap state

**Files:**

- Modify: `src/features/Onboarding/Agent/index.tsx`

- Create: `src/features/Onboarding/Agent/index.test.tsx`

- [ ] **Step 1: Add a failing integration test for bootstrap without `activeNode`**

```typescript
// src/features/Onboarding/Agent/index.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import AgentOnboardingPage from './index';

describe('AgentOnboardingPage', () => {
  it('boots with minimal onboarding state', () => {
render(
  <AgentOnboardingPage />,
);

expect(screen.getByText(/Onboarding/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the conversation test file to confirm failure**

Run: `bunx vitest run --silent='passed-only' 'src/features/Onboarding/Agent/index.test.tsx'`
Expected: FAIL until the page-level mocks and bootstrap handling no longer assume `activeNode`

- [ ] **Step 3: Remove hard requirements on `activeNode` during bootstrap**

```typescript
const resolvedContext = resolveAgentOnboardingContext({
  bootstrapContext: data,
  storedAgentOnboarding: agentOnboarding,
});

const topicId = resolvedContext.topicId;

if (!topicId) {
  throw new Error('Onboarding topic is required');
}
```

- [ ] **Step 4: Re-run the page-level tests to confirm the UI still boots**

Run: `bunx vitest run --silent='passed-only' 'src/features/Onboarding/Agent/index.test.tsx' 'src/features/Onboarding/Agent/context.test.ts'`
Expected: PASS

- [ ] **Step 5: Commit the onboarding page bootstrap fix**

```bash
git add src/features/Onboarding/Agent/index.tsx src/features/Onboarding/Agent/index.test.tsx
git commit -m "♻️ refactor(onboarding): simplify onboarding bootstrap state"
```

### Task 9: Run the focused verification suite and prepare the execution handoff

**Files:**

- Modify: `docs/superpowers/plans/2026-03-25-onboarding-save-user-question-simplification.md`

- [ ] **Step 1: Run the complete focused verification suite**

Run: `bunx vitest run --silent='passed-only' 'packages/types/src/user/agentOnboarding.test.ts' 'packages/builtin-agent-onboarding/src/systemRole.test.ts' 'src/server/services/onboarding/index.test.ts' 'src/utils/webOnboardingToolResult.test.ts' 'src/store/tool/slices/builtin/executors/lobe-web-onboarding.test.ts' 'src/features/Onboarding/Agent/context.test.ts' 'src/features/Onboarding/Agent/index.test.tsx' 'src/features/Onboarding/Agent/Conversation.test.tsx'`
Expected: PASS

- [ ] **Step 2: Run type-checking for the impacted packages and app surface**

Run: `bun run type-check`
Expected: PASS

- [ ] **Step 3: Update the plan checklist state and record any deviations**

```markdown
- [ ] Confirm all renamed APIs (`saveUserQuestion`) replaced `saveAnswer`
- [ ] Confirm no onboarding markdown writes happen outside document tools
- [ ] Confirm no persisted `completedNodes` / `draft` assumptions remain in onboarding UI
```

- [ ] **Step 4: Commit the final verification pass**

```bash
git add docs/superpowers/plans/2026-03-25-onboarding-save-user-question-simplification.md
git commit -m "📝 docs(onboarding): finalize saveUserQuestion simplification plan"
```

- [ ] **Step 5: Hand off for execution**

```text
Plan complete. Execute with superpowers:executing-plans in this harness, preserving the chunk order above.
```
