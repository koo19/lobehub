# Onboarding Generic Interaction Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild onboarding around a generic user-interaction tool and long-term generic agent document tools, while removing onboarding-owned question persistence and `IDENTITY.md`.

**Architecture:** Keep `web-onboarding` as the domain state machine for node validation and completion, but move question asking into a new generic builtin tool and move document perception/editing onto the existing `lobe-agent-documents` package with discovery APIs. The inbox agent becomes the canonical owner of `avatar`, `title`, and `SOUL.md`, while onboarding no longer stores `questionSurface` or writes `IDENTITY.md`.

**Tech Stack:** TypeScript, React, Zustand, TRPC, builtin tool runtime registry, Vitest

**Spec Basis:** Approved design discussion on 2026-03-25 in this thread; no standalone spec document exists yet.

**Implementation skills:** @typescript, @testing, @react, @zustand

---

## File Structure

| File                                                                                            | Action | Responsibility                                                                                   |
| ----------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------ |
| `packages/builtin-tool-agent-documents/src/types.ts`                                            | Modify | Add discovery and filename-oriented document APIs                                                |
| `packages/builtin-tool-agent-documents/src/manifest.ts`                                         | Modify | Expose new generic document APIs in builtin manifest                                             |
| `packages/builtin-tool-agent-documents/src/ExecutionRuntime/index.ts`                           | Modify | Implement `listDocuments`, `readDocumentByFilename`, `upsertDocumentByFilename` runtime behavior |
| `packages/builtin-tool-agent-documents/src/index.ts`                                            | Modify | Export new API names and types                                                                   |
| `src/server/services/agentDocuments.ts`                                                         | Modify | Add list/read/upsert helpers needed by generic tool runtime                                      |
| `src/server/routers/lambda/agentDocument.ts`                                                    | Modify | Expose list/read/upsert filename APIs over TRPC                                                  |
| `src/services/agentDocument.ts`                                                                 | Modify | Add client wrappers for new document APIs                                                        |
| `src/server/services/toolExecution/serverRuntimes/agentDocuments.ts`                            | Modify | Register new server runtime methods                                                              |
| `src/store/tool/slices/builtin/executors/lobe-agent-documents.ts`                               | Modify | Register new client executor methods                                                             |
| `src/server/services/agentDocuments.test.ts`                                                    | Modify | Cover discovery and filename-oriented document operations                                        |
| `packages/builtin-tool-user-interaction/package.json`                                           | Create | New generic interaction tool package manifest                                                    |
| `packages/builtin-tool-user-interaction/src/types.ts`                                           | Create | Question schema and `submit/skip/cancel` result schema                                           |
| `packages/builtin-tool-user-interaction/src/manifest.ts`                                        | Create | Builtin tool manifest for interaction APIs                                                       |
| `packages/builtin-tool-user-interaction/src/systemRole.ts`                                      | Create | Tool usage rules for interaction lifecycle                                                       |
| `packages/builtin-tool-user-interaction/src/ExecutionRuntime/index.ts`                          | Create | Runtime state transitions for ask/submit/skip/cancel/get-state                                   |
| `packages/builtin-tool-user-interaction/src/executor/index.ts`                                  | Create | Frontend executor class                                                                          |
| `packages/builtin-tool-user-interaction/src/client/index.ts`                                    | Create | Client exports for intervention UI                                                               |
| `packages/builtin-tool-user-interaction/src/client/Intervention/index.ts`                       | Create | Registry for custom interaction intervention UI                                                  |
| `packages/builtin-tool-user-interaction/src/client/Intervention/AskUserQuestion/index.tsx`      | Create | Tool-specific submit/skip/cancel UI                                                              |
| `packages/builtin-tool-user-interaction/src/index.ts`                                           | Create | Package entry exports                                                                            |
| `packages/builtin-tool-user-interaction/src/ExecutionRuntime/index.test.ts`                     | Create | Runtime tests for interaction result transitions                                                 |
| `packages/builtin-tool-user-interaction/src/client/Intervention/AskUserQuestion/index.test.tsx` | Create | UI tests for submit/skip/cancel behavior                                                         |
| `packages/builtin-tools/src/index.ts`                                                           | Modify | Register the new generic interaction tool manifest                                               |
| `packages/builtin-tools/src/interventions.ts`                                                   | Modify | Register interaction intervention component metadata                                             |
| `packages/types/src/tool/builtin.ts`                                                            | Modify | Extend builtin intervention props for custom interaction actions / footer mode                   |
| `src/features/Conversation/Messages/AssistantGroup/Tool/Detail/Intervention/index.tsx`          | Modify | Support non-approval interaction UIs without default approve/reject footer                       |
| `src/features/Conversation/store/slices/tool/action.ts`                                         | Modify | Add `submitToolInteraction`, `skipToolInteraction`, `cancelToolInteraction` actions              |
| `src/features/Conversation/store/slices/tool/action.test.ts`                                    | Modify | Cover new interaction actions                                                                    |
| `src/store/chat/slices/aiChat/actions/conversationControl.ts`                                   | Modify | Persist interaction result into tool message and resume runtime                                  |
| `src/store/chat/slices/aiChat/actions/__tests__/conversationControl.test.ts`                    | Modify | Verify submit/skip/cancel resume behavior                                                        |
| `src/store/chat/slices/operation/types.ts`                                                      | Modify | Add operation kinds for interaction submission/skip/cancel                                       |
| `src/store/tool/slices/builtin/executors/index.ts`                                              | Modify | Register new user-interaction executor                                                           |
| `src/store/tool/slices/builtin/executors/lobe-user-interaction.ts`                              | Create | Client-side executor wiring for generic interaction tool                                         |
| `src/server/services/toolExecution/serverRuntimes/index.ts`                                     | Modify | Register new user-interaction runtime                                                            |
| `src/server/services/toolExecution/serverRuntimes/userInteraction.ts`                           | Create | Server runtime wiring for generic interaction tool                                               |
| `src/locales/default/plugin.ts`                                                                 | Modify | Add localization keys for new document APIs and interaction tool APIs                            |
| `packages/types/src/user/agentOnboarding.ts`                                                    | Modify | Remove onboarding-owned question schema and `questionSurface`                                    |
| `packages/builtin-tool-web-onboarding/src/types.ts`                                             | Modify | Remove `askUserQuestion` from onboarding-domain tool API                                         |
| `packages/builtin-tool-web-onboarding/src/manifest.ts`                                          | Modify | Remove question-surface API from onboarding manifest                                             |
| `src/store/tool/slices/builtin/executors/lobe-web-onboarding.ts`                                | Modify | Remove onboarding ask-question executor                                                          |
| `src/server/services/toolExecution/serverRuntimes/webOnboarding.ts`                             | Modify | Remove onboarding ask-question runtime path                                                      |
| `packages/builtin-agent-onboarding/src/systemRole.ts`                                           | Modify | Instruct onboarding agent to use generic interaction tool                                        |
| `packages/builtin-agent-onboarding/src/toolSystemRole.ts`                                       | Modify | Update onboarding tool-only prompt rules                                                         |
| `src/server/services/onboarding/index.ts`                                                       | Modify | Drop `questionSurface`; keep state machine + inbox/SOUL side effects only                        |
| `src/server/services/onboarding/documentHelpers.ts`                                             | Modify | Build managed `SOUL.md` sections; remove identity document builder                               |
| `src/server/services/onboarding/documentHelpers.test.ts`                                        | Modify | Validate managed `SOUL.md` structure                                                             |
| `src/server/services/onboarding/index.test.ts`                                                  | Modify | Cover new onboarding state shape and side effects                                                |
| `packages/builtin-agents/src/agents/web-onboarding/index.ts`                                    | Modify | Enable generic interaction tool and generic document tools                                       |
| `packages/builtin-agents/src/agents/inbox/index.ts`                                             | Modify | Enable generic document tools by default                                                         |
| `src/features/Onboarding/Agent/Conversation.tsx`                                                | Modify | Remove onboarding-inline question renderer; keep summary CTA only                                |
| `src/features/Onboarding/Agent/index.tsx`                                                       | Modify | Stop threading `currentQuestion` through onboarding view state                                   |
| `src/features/Onboarding/Agent/context.ts`                                                      | Modify | Resolve only active node/topic from onboarding state                                             |
| `src/features/Onboarding/Agent/context.test.ts`                                                 | Modify | Remove `questionSurface` assumptions                                                             |
| `src/features/Onboarding/Agent/QuestionRenderer.tsx`                                            | Delete | Old onboarding-only inline question renderer                                                     |
| `src/features/Onboarding/Agent/QuestionRendererView.tsx`                                        | Delete | Old onboarding-only inline renderer wrapper                                                      |
| `src/features/Onboarding/Agent/questionRendererRuntime.tsx`                                     | Delete | Old onboarding-only runtime wrapper                                                              |
| `src/features/Onboarding/Agent/questionRendererSchema.ts`                                       | Delete | Old onboarding-only schema adapter                                                               |
| `src/features/Onboarding/Agent/ResponseLanguageInlineStep.tsx`                                  | Delete | Response-language special-case UI replaced by generic interaction tool                           |
| `src/features/Onboarding/Agent/QuestionRenderer.test.tsx`                                       | Delete | Obsolete renderer tests                                                                          |
| `src/features/Onboarding/Agent/QuestionRenderer.runtime.test.tsx`                               | Delete | Obsolete renderer runtime tests                                                                  |
| `src/features/Onboarding/Agent/ResponseLanguageInlineStep.test.tsx`                             | Delete | Obsolete special-case UI tests                                                                   |
| `src/features/Onboarding/Agent/Conversation.test.tsx`                                           | Modify | Assert tool-driven interaction flow and summary CTA only                                         |
| `packages/database/src/models/agentDocuments/templates/claw/index.ts`                           | Modify | Remove `IDENTITY.md` from default template set                                                   |
| `packages/database/src/models/agentDocuments/templates/claw/agent.ts`                           | Modify | Remove runtime assumptions about `IDENTITY.md`                                                   |
| `packages/database/src/models/agentDocuments/templates/claw/identity.ts`                        | Delete | Retire identity document template                                                                |
| `packages/database/src/models/agentDocuments/__tests__/template.test.ts`                        | Modify | Update template expectations after removing `IDENTITY.md`                                        |

---

### Task 1: Extend generic agent document tools with discovery and filename access ⚡ _Parallelizable with Task 2_

**Files:**

- Modify: `packages/builtin-tool-agent-documents/src/types.ts`

- Modify: `packages/builtin-tool-agent-documents/src/manifest.ts`

- Modify: `packages/builtin-tool-agent-documents/src/ExecutionRuntime/index.ts`

- Modify: `packages/builtin-tool-agent-documents/src/index.ts`

- Modify: `src/server/services/agentDocuments.ts`

- Modify: `src/server/routers/lambda/agentDocument.ts`

- Modify: `src/services/agentDocument.ts`

- Modify: `src/server/services/toolExecution/serverRuntimes/agentDocuments.ts`

- Modify: `src/store/tool/slices/builtin/executors/lobe-agent-documents.ts`

- Modify: `src/locales/default/plugin.ts`

- Modify: `src/server/services/agentDocuments.test.ts`

- [ ] **Step 1: Write failing tests for discovery and filename-oriented access**

```typescript
// src/server/services/agentDocuments.test.ts
it('lists documents for tool discovery', async () => {
  const docs = await service.listDocuments(agentId);
  expect(docs.map((doc) => doc.filename)).toContain('SOUL.md');
});

it('reads a document by filename inside an agent scope', async () => {
  const doc = await service.getDocument(agentId, 'SOUL.md');
  expect(doc?.filename).toBe('SOUL.md');
});

it('upserts a document by filename without creating duplicates', async () => {
  await service.upsertDocument({ agentId, filename: 'SOUL.md', content: '# next' });
  const docs = await service.getAgentDocuments(agentId);
  expect(docs.filter((doc) => doc.filename === 'SOUL.md')).toHaveLength(1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bunx vitest run --silent='passed-only' 'src/server/services/agentDocuments.test.ts'`
Expected: FAIL with missing method / API expectation errors

- [ ] **Step 3: Add discovery and filename APIs to the generic tool surface**

```typescript
// packages/builtin-tool-agent-documents/src/types.ts
export const AgentDocumentsApiName = {
  createDocument: 'createDocument',
  copyDocument: 'copyDocument',
  editDocument: 'editDocument',
  listDocuments: 'listDocuments',
  readDocument: 'readDocument',
  readDocumentByFilename: 'readDocumentByFilename',
  removeDocument: 'removeDocument',
  renameDocument: 'renameDocument',
  updateLoadRule: 'updateLoadRule',
  upsertDocumentByFilename: 'upsertDocumentByFilename',
} as const;
```

```typescript
// packages/builtin-tool-agent-documents/src/ExecutionRuntime/index.ts
async listDocuments(_args: Record<string, never>, context?: AgentDocumentOperationContext) {
  const agentId = this.resolveAgentId(context);
  if (!agentId) return { content: 'Cannot list agent documents without agentId context.', success: false };

  const docs = await this.service.listDocuments({ agentId });
  return {
    content: JSON.stringify(docs, null, 2),
    state: { documents: docs },
    success: true,
  };
}
```

```typescript
// src/server/services/agentDocuments.ts
async listDocuments(agentId: string) {
  const docs = await this.getAgentDocuments(agentId);
  return docs.map((doc) => ({
    filename: doc.filename,
    id: doc.id,
    loadPosition: doc.policyLoadPosition,
    title: doc.title,
  }));
}
```

- [ ] **Step 4: Run targeted tests to verify the new APIs pass**

Run: `bunx vitest run --silent='passed-only' 'src/server/services/agentDocuments.test.ts'`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/builtin-tool-agent-documents/src/types.ts packages/builtin-tool-agent-documents/src/manifest.ts packages/builtin-tool-agent-documents/src/ExecutionRuntime/index.ts packages/builtin-tool-agent-documents/src/index.ts src/server/services/agentDocuments.ts src/server/routers/lambda/agentDocument.ts src/services/agentDocument.ts src/server/services/toolExecution/serverRuntimes/agentDocuments.ts src/store/tool/slices/builtin/executors/lobe-agent-documents.ts src/locales/default/plugin.ts src/server/services/agentDocuments.test.ts
git commit -m "✨ feat(onboarding): extend generic agent document discovery"
```

### Task 2: Create the generic `user-interaction` builtin tool package ⚡ _Parallelizable with Task 1_

> **pnpm workspace:** This task creates a new package. After creating the package directory and `package.json`, run `pnpm install` to link it in the workspace. Consuming packages (`packages/builtin-tools`, `packages/builtin-agents`) must add `@lobechat/builtin-tool-user-interaction` as a dependency before Task 3.

**Files:**

- Create: `packages/builtin-tool-user-interaction/package.json`

- Create: `packages/builtin-tool-user-interaction/tsconfig.json`

- Create: `packages/builtin-tool-user-interaction/src/types.ts`

- Create: `packages/builtin-tool-user-interaction/src/manifest.ts`

- Create: `packages/builtin-tool-user-interaction/src/systemRole.ts`

- Create: `packages/builtin-tool-user-interaction/src/ExecutionRuntime/index.ts`

- Create: `packages/builtin-tool-user-interaction/src/executor/index.ts`

- Create: `packages/builtin-tool-user-interaction/src/client/index.ts`

- Create: `packages/builtin-tool-user-interaction/src/client/Intervention/index.ts`

- Create: `packages/builtin-tool-user-interaction/src/client/Intervention/AskUserQuestion/index.tsx`

- Create: `packages/builtin-tool-user-interaction/src/index.ts`

- Create: `packages/builtin-tool-user-interaction/src/ExecutionRuntime/index.test.ts`

- Create: `packages/builtin-tool-user-interaction/src/client/Intervention/AskUserQuestion/index.test.tsx`

- [ ] **Step 1: Write failing tests for interaction state transitions**

```typescript
// packages/builtin-tool-user-interaction/src/ExecutionRuntime/index.test.ts
it('creates a pending interaction request', async () => {
  const result = await runtime.askUserQuestion(
    {
      question: { id: 'agent-identity', mode: 'form', prompt: 'Name yourself' },
    },
    { agentId: 'agent-1' },
  );

  expect(result.success).toBe(true);
  expect(result.state.status).toBe('pending');
});

it('marks an interaction as skipped with an optional reason', async () => {
  const result = await runtime.skipUserResponse(
    { requestId: 'req_1', reason: 'Too vague' },
    { agentId: 'agent-1' },
  );
  expect(result.state.result.type).toBe('skipped');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bunx vitest run --silent='passed-only' 'packages/builtin-tool-user-interaction/src/ExecutionRuntime/index.test.ts'`
Expected: FAIL with module not found

- [ ] **Step 3: Implement the generic interaction package**

Create `tsconfig.json` by referencing sibling packages (e.g., `packages/builtin-tool-web-onboarding/tsconfig.json`).

After creating the package directory structure and `package.json`, run `pnpm install` to register the workspace link.

```typescript
// packages/builtin-tool-user-interaction/src/types.ts
export const UserInteractionApiName = {
  askUserQuestion: 'askUserQuestion',
  cancelUserResponse: 'cancelUserResponse',
  getInteractionState: 'getInteractionState',
  skipUserResponse: 'skipUserResponse',
  submitUserResponse: 'submitUserResponse',
} as const;

export type UserInteractionResult =
  | { type: 'submitted'; requestId: string; response: Record<string, unknown> }
  | { type: 'skipped'; requestId: string; reason?: string }
  | { type: 'cancelled'; requestId: string };
```

```typescript
// packages/builtin-tool-user-interaction/src/ExecutionRuntime/index.ts
async submitUserResponse(args, context) {
  const request = await this.service.getInteractionState({ agentId, requestId: args.requestId });
  const nextState = {
    ...request,
    result: { requestId: args.requestId, response: args.response, type: 'submitted' },
    status: 'submitted',
  };
  return { content: 'User submitted an interaction response.', state: nextState, success: true };
}
```

- [ ] **Step 4: Run package tests for runtime and UI**

Run: `bunx vitest run --silent='passed-only' 'packages/builtin-tool-user-interaction/src/ExecutionRuntime/index.test.ts' 'packages/builtin-tool-user-interaction/src/client/Intervention/AskUserQuestion/index.test.tsx'`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/builtin-tool-user-interaction
git commit -m "✨ feat(onboarding): add generic user interaction builtin tool"
```

### Task 3: Wire interaction semantics into builtin intervention and conversation control

**Files:**

- Modify: `packages/types/src/tool/builtin.ts`

- Modify: `packages/builtin-tools/src/index.ts`

- Modify: `packages/builtin-tools/src/interventions.ts`

- Modify: `src/features/Conversation/Messages/AssistantGroup/Tool/Detail/Intervention/index.tsx`

- Modify: `src/features/Conversation/store/slices/tool/action.ts`

- Modify: `src/features/Conversation/store/slices/tool/action.test.ts`

- Modify: `src/store/chat/slices/aiChat/actions/conversationControl.ts`

- Modify: `src/store/chat/slices/aiChat/actions/__tests__/conversationControl.test.ts`

- Modify: `src/store/chat/slices/operation/types.ts`

- Modify: `src/store/tool/slices/builtin/executors/index.ts`

- Create: `src/store/tool/slices/builtin/executors/lobe-user-interaction.ts`

- Modify: `src/server/services/toolExecution/serverRuntimes/index.ts`

- Create: `src/server/services/toolExecution/serverRuntimes/userInteraction.ts`

- Modify: `src/locales/default/plugin.ts`

- [ ] **Step 1: Write failing tests for submit/skip/cancel conversation actions**

```typescript
// src/features/Conversation/store/slices/tool/action.test.ts
it('submits tool interaction results and resumes the agent', async () => {
  await store.getState().submitToolInteraction('tool-msg-1', { name: 'Lobe' });
  expect(mockSubmitToolInteraction).toHaveBeenCalledWith(
    'tool-msg-1',
    { name: 'Lobe' },
    expect.anything(),
  );
});

it('skips tool interaction results and resumes the agent', async () => {
  await store.getState().skipToolInteraction('tool-msg-1', 'Need a clearer prompt');
  expect(mockSkipToolInteraction).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bunx vitest run --silent='passed-only' 'src/features/Conversation/store/slices/tool/action.test.ts' 'src/store/chat/slices/aiChat/actions/__tests__/conversationControl.test.ts'`
Expected: FAIL with missing action names and missing operation types

- [ ] **Step 3: Implement non-approval interaction actions and custom intervention mode**

```typescript
// packages/types/src/tool/builtin.ts
export interface BuiltinInterventionProps<Arguments = any> {
  apiName?: string;
  args: Arguments;
  identifier?: string;
  interactionMode?: 'approval' | 'custom';
  messageId: string;
  onInteractionAction?: (
    action:
      | { type: 'submit'; payload: Record<string, unknown> }
      | { type: 'skip'; reason?: string }
      | { type: 'cancel' },
  ) => Promise<void>;
}
```

```typescript
// src/store/chat/slices/aiChat/actions/conversationControl.ts
submitToolInteraction = async (
  messageId: string,
  response: Record<string, unknown>,
  context?: ConversationContext,
) => {
  await this.#get().optimisticUpdatePlugin(
    messageId,
    {
      state: {
        result: { response, type: 'submitted' },
        status: 'submitted',
      },
    },
    optimisticContext,
  );

  await this.#get().optimisticUpdateMessageContent(
    messageId,
    `User submitted interaction response: ${JSON.stringify(response)}`,
    undefined,
    optimisticContext,
  );

  await internal_execAgentRuntime({
    context: effectiveContext,
    initialContext: { ...initialContext, phase: 'user_input' },
    initialState: state,
    messages: currentMessages,
    parentMessageId: messageId,
    parentMessageType: 'tool',
  });
};
```

- [ ] **Step 4: Run targeted action and runtime registration tests**

Run: `bunx vitest run --silent='passed-only' 'src/features/Conversation/store/slices/tool/action.test.ts' 'src/store/chat/slices/aiChat/actions/__tests__/conversationControl.test.ts' 'src/store/tool/slices/builtin/executors/index.test.ts'`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/types/src/tool/builtin.ts packages/builtin-tools/src/index.ts packages/builtin-tools/src/interventions.ts src/features/Conversation/Messages/AssistantGroup/Tool/Detail/Intervention/index.tsx src/features/Conversation/store/slices/tool/action.ts src/features/Conversation/store/slices/tool/action.test.ts src/store/chat/slices/aiChat/actions/conversationControl.ts src/store/chat/slices/aiChat/actions/__tests__/conversationControl.test.ts src/store/chat/slices/operation/types.ts src/store/tool/slices/builtin/executors/index.ts src/store/tool/slices/builtin/executors/lobe-user-interaction.ts src/server/services/toolExecution/serverRuntimes/index.ts src/server/services/toolExecution/serverRuntimes/userInteraction.ts src/locales/default/plugin.ts
git commit -m "✨ feat(onboarding): wire generic tool interaction semantics"
```

### Task 4: Rebuild onboarding domain types and tool surface around state-only responsibilities

**Files:**

- Modify: `packages/types/src/user/agentOnboarding.ts`

- Modify: `packages/builtin-tool-web-onboarding/src/types.ts`

- Modify: `packages/builtin-tool-web-onboarding/src/manifest.ts`

- Modify: `src/store/tool/slices/builtin/executors/lobe-web-onboarding.ts`

- Modify: `src/server/services/toolExecution/serverRuntimes/webOnboarding.ts`

- Modify: `packages/builtin-agent-onboarding/src/systemRole.ts`

- Modify: `packages/builtin-agent-onboarding/src/toolSystemRole.ts`

- Modify: `src/server/services/onboarding/index.ts`

- Modify: `src/server/services/onboarding/documentHelpers.ts`

- Modify: `src/server/services/onboarding/documentHelpers.test.ts`

- Modify: `src/server/services/onboarding/index.test.ts`

- Modify: `src/store/tool/slices/builtin/executors/lobe-web-onboarding.test.ts`

- Modify: `src/store/tool/slices/builtin/executors/index.test.ts`

- [ ] **Step 1: Write failing tests for the new onboarding state shape**

```typescript
// src/server/services/onboarding/index.test.ts
it('does not persist questionSurface after reading onboarding state', async () => {
  const result = await service.getState();
  expect('currentQuestion' in result).toBe(false);
});

it('does not write IDENTITY.md when committing agentIdentity', async () => {
  await service.saveAnswer({
    updates: [
      {
        node: 'agentIdentity',
        patch: { emoji: '🦊', name: 'Fox', nature: 'familiar', vibe: 'warm' },
      },
    ],
  });

  expect(mockAgentDocumentsService.upsertDocument).not.toHaveBeenCalledWith(
    expect.objectContaining({ filename: 'IDENTITY.md' }),
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bunx vitest run --silent='passed-only' 'src/server/services/onboarding/index.test.ts' 'src/store/tool/slices/builtin/executors/lobe-web-onboarding.test.ts'`
Expected: FAIL with stale `currentQuestion` / `askUserQuestion` assumptions

- [ ] **Step 3: Remove onboarding-owned question persistence and shrink the domain tool**

```typescript
// packages/builtin-tool-web-onboarding/src/types.ts
export const WebOnboardingApiName = {
  completeCurrentStep: 'completeCurrentStep',
  finishOnboarding: 'finishOnboarding',
  getOnboardingState: 'getOnboardingState',
  returnToOnboarding: 'returnToOnboarding',
  saveAnswer: 'saveAnswer',
} as const;
```

```typescript
// packages/types/src/user/agentOnboarding.ts
export interface UserAgentOnboardingContext {
  activeNode?: UserAgentOnboardingNode;
  activeNodeDraftState?: { missingFields?: string[]; status: 'complete' | 'empty' | 'partial' };
  committed: Record<string, unknown>;
  completedNodes: UserAgentOnboardingNode[];
  control: UserAgentOnboardingControl;
  draft: UserAgentOnboardingDraft;
  finishedAt?: string;
  topicId?: string;
  version: number;
}
```

```typescript
// src/server/services/onboarding/index.ts
const allowedTools = ['getOnboardingState', 'returnToOnboarding'];
if (activeNode && activeNode !== 'summary') {
  allowedTools.push('saveAnswer');
  if (canCompleteCurrentStep) allowedTools.push('completeCurrentStep');
}
if (activeNode === 'summary') {
  allowedTools.push('finishOnboarding');
}
```

- [ ] **Step 4: Run targeted onboarding tests**

Run: `bunx vitest run --silent='passed-only' 'src/server/services/onboarding/index.test.ts' 'src/store/tool/slices/builtin/executors/lobe-web-onboarding.test.ts' 'src/store/tool/slices/builtin/executors/index.test.ts'`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/types/src/user/agentOnboarding.ts packages/builtin-tool-web-onboarding/src/types.ts packages/builtin-tool-web-onboarding/src/manifest.ts src/store/tool/slices/builtin/executors/lobe-web-onboarding.ts src/server/services/toolExecution/serverRuntimes/webOnboarding.ts packages/builtin-agent-onboarding/src/systemRole.ts packages/builtin-agent-onboarding/src/toolSystemRole.ts src/server/services/onboarding/index.ts src/server/services/onboarding/documentHelpers.ts src/server/services/onboarding/documentHelpers.test.ts src/server/services/onboarding/index.test.ts src/store/tool/slices/builtin/executors/lobe-web-onboarding.test.ts src/store/tool/slices/builtin/executors/index.test.ts
git commit -m "♻️ refactor(onboarding): remove onboarding-owned question persistence"
```

### Task 5: Rewrite onboarding UI to consume generic interaction tool messages

**Files:**

- Modify: `packages/builtin-agents/src/agents/web-onboarding/index.ts`

- Modify: `packages/builtin-agents/src/agents/inbox/index.ts`

- Modify: `src/features/Onboarding/Agent/Conversation.tsx`

- Modify: `src/features/Onboarding/Agent/index.tsx`

- Modify: `src/features/Onboarding/Agent/context.ts`

- Modify: `src/features/Onboarding/Agent/context.test.ts`

- Modify: `src/features/Onboarding/Agent/Conversation.test.tsx`

- Delete: `src/features/Onboarding/Agent/QuestionRenderer.tsx`

- Delete: `src/features/Onboarding/Agent/QuestionRendererView.tsx`

- Delete: `src/features/Onboarding/Agent/questionRendererRuntime.tsx`

- Delete: `src/features/Onboarding/Agent/questionRendererSchema.ts`

- Delete: `src/features/Onboarding/Agent/ResponseLanguageInlineStep.tsx`

- Delete: `src/features/Onboarding/Agent/QuestionRenderer.test.tsx`

- Delete: `src/features/Onboarding/Agent/QuestionRenderer.runtime.test.tsx`

- Delete: `src/features/Onboarding/Agent/ResponseLanguageInlineStep.test.tsx`

- [ ] **Step 1: Write failing tests for the simplified onboarding conversation**

```typescript
// src/features/Onboarding/Agent/Conversation.test.tsx
it('does not render onboarding-owned inline question widgets', () => {
  render(<AgentOnboardingConversation activeNode="agentIdentity" readOnly={false} />);
  expect(screen.queryByTestId('onboarding-question-renderer')).not.toBeInTheDocument();
});

it('still renders summary completion CTA when activeNode is summary', () => {
  render(<AgentOnboardingConversation activeNode="summary" readOnly={false} />);
  expect(screen.getByRole('button', { name: /finish/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bunx vitest run --silent='passed-only' 'src/features/Onboarding/Agent/Conversation.test.tsx' 'src/features/Onboarding/Agent/context.test.ts'`
Expected: FAIL because current UI still depends on `currentQuestion` and renderer files

- [ ] **Step 3: Remove onboarding-only renderers and rely on tool-message interaction UI**

```tsx
// src/features/Onboarding/Agent/Conversation.tsx
const endRender =
  id !== lastAssistantMessageId ? undefined : showCompletionCTA ? completionRender : undefined;
```

```typescript
// packages/builtin-agents/src/agents/web-onboarding/index.ts
plugins: [WebOnboardingIdentifier, AgentDocumentsIdentifier, UserInteractionIdentifier, ...(ctx.plugins || [])],
```

```typescript
// packages/builtin-agents/src/agents/inbox/index.ts
plugins: [AgentDocumentsIdentifier, ...(ctx.plugins || [])],
```

- [ ] **Step 4: Run targeted onboarding UI tests**

Run: `bunx vitest run --silent='passed-only' 'src/features/Onboarding/Agent/Conversation.test.tsx' 'src/features/Onboarding/Agent/context.test.ts'`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/builtin-agents/src/agents/web-onboarding/index.ts packages/builtin-agents/src/agents/inbox/index.ts src/features/Onboarding/Agent/Conversation.tsx src/features/Onboarding/Agent/index.tsx src/features/Onboarding/Agent/context.ts src/features/Onboarding/Agent/context.test.ts src/features/Onboarding/Agent/Conversation.test.tsx
git rm src/features/Onboarding/Agent/QuestionRenderer.tsx src/features/Onboarding/Agent/QuestionRendererView.tsx src/features/Onboarding/Agent/questionRendererRuntime.tsx src/features/Onboarding/Agent/questionRendererSchema.ts src/features/Onboarding/Agent/ResponseLanguageInlineStep.tsx src/features/Onboarding/Agent/QuestionRenderer.test.tsx src/features/Onboarding/Agent/QuestionRenderer.runtime.test.tsx src/features/Onboarding/Agent/ResponseLanguageInlineStep.test.tsx
git commit -m "♻️ refactor(onboarding): switch UI to generic interaction tool"
```

### Task 6: Rewrite onboarding side effects around inbox metadata and managed `SOUL.md`, then remove `IDENTITY.md`

**Files:**

- Modify: `src/server/services/onboarding/documentHelpers.ts`

- Modify: `src/server/services/onboarding/documentHelpers.test.ts`

- Modify: `src/server/services/onboarding/index.ts`

- Modify: `src/server/services/onboarding/index.test.ts`

- Modify: `packages/database/src/models/agentDocuments/templates/claw/index.ts`

- Modify: `packages/database/src/models/agentDocuments/templates/claw/agent.ts`

- Delete: `packages/database/src/models/agentDocuments/templates/claw/identity.ts`

- Modify: `packages/database/src/models/agentDocuments/__tests__/template.test.ts`

- [ ] **Step 1: Write failing tests for inbox metadata and managed `SOUL.md` output**

```typescript
// src/server/services/onboarding/documentHelpers.test.ts
it('renders a managed Identity Core section inside SOUL.md', () => {
  const result = buildSoulDocument({
    agentIdentity: { emoji: '🦊', name: 'Fox', nature: 'familiar', vibe: 'warm' },
    profile: {},
    version: 1,
  });

  expect(result).toContain('## Identity Core');
  expect(result).toContain('- **Creature:** familiar');
  expect(result).toContain('- **Vibe:** warm');
});
```

```typescript
// src/server/services/onboarding/index.test.ts
it('updates inbox avatar/title from agentIdentity', async () => {
  await service.saveAnswer({
    updates: [
      {
        node: 'agentIdentity',
        patch: { emoji: '🦊', name: 'Fox', nature: 'familiar', vibe: 'warm' },
      },
    ],
  });

  expect(mockAgentModel.updateConfig).toHaveBeenCalledWith(
    'inbox-agent-id',
    expect.objectContaining({ avatar: '🦊', title: 'Fox' }),
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bunx vitest run --silent='passed-only' 'src/server/services/onboarding/documentHelpers.test.ts' 'src/server/services/onboarding/index.test.ts' 'packages/database/src/models/agentDocuments/__tests__/template.test.ts'`
Expected: FAIL because `SOUL.md` lacks managed identity section and `IDENTITY.md` still exists

- [ ] **Step 3: Implement the new side effects and delete `IDENTITY.md`**

```typescript
// src/server/services/onboarding/index.ts
await this.agentModel.updateConfig(inboxAgentId, {
  avatar: state.agentIdentity?.emoji,
  title: state.agentIdentity?.name,
});

await this.agentDocumentsService.upsertDocument({
  agentId: inboxAgentId,
  content: buildSoulDocument(state),
  filename: 'SOUL.md',
});
```

```typescript
// packages/database/src/models/agentDocuments/templates/claw/index.ts
templates: [SOUL_DOCUMENT, AGENT_DOCUMENT],
```

```markdown
<!-- packages/database/src/models/agentDocuments/templates/claw/agent.ts -->

- Use `SOUL.md` to anchor behavior and self-definition.
- Do not assume `IDENTITY.md` exists.
```

- [ ] **Step 4: Run full targeted verification and type-check**

Run: `bunx vitest run --silent='passed-only' 'src/server/services/agentDocuments.test.ts' 'packages/builtin-tool-user-interaction/src/ExecutionRuntime/index.test.ts' 'packages/builtin-tool-user-interaction/src/client/Intervention/AskUserQuestion/index.test.tsx' 'src/features/Conversation/store/slices/tool/action.test.ts' 'src/store/chat/slices/aiChat/actions/__tests__/conversationControl.test.ts' 'src/server/services/onboarding/index.test.ts' 'src/server/services/onboarding/documentHelpers.test.ts' 'src/features/Onboarding/Agent/Conversation.test.tsx' 'src/features/Onboarding/Agent/context.test.ts' 'packages/database/src/models/agentDocuments/__tests__/template.test.ts'`

Run: `bun run type-check`

Expected: All targeted tests PASS; type-check exits successfully

- [ ] **Step 5: Commit**

```bash
git add src/server/services/onboarding/documentHelpers.ts src/server/services/onboarding/documentHelpers.test.ts src/server/services/onboarding/index.ts src/server/services/onboarding/index.test.ts packages/database/src/models/agentDocuments/templates/claw/index.ts packages/database/src/models/agentDocuments/templates/claw/agent.ts packages/database/src/models/agentDocuments/__tests__/template.test.ts
git rm packages/database/src/models/agentDocuments/templates/claw/identity.ts
git commit -m "🔥 refactor(onboarding): remove identity doc and rewrite soul sync"
```

---

## Acceptance Criteria

| Area                     | Acceptance Criterion                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Generic document tools   | Agents can list documents, read `SOUL.md` by filename, and upsert `SOUL.md` without hidden onboarding helpers |
| Generic interaction tool | `askUserQuestion` is no longer onboarding-specific and supports `submit`, `skip`, and `cancel`                |
| Conversation runtime     | Interaction UI no longer relies on approve/reject semantics for question answering                            |
| Onboarding state         | `UserAgentOnboarding` no longer stores `questionSurface` or onboarding-specific question schema               |
| Onboarding side effects  | `emoji` and `name` update inbox `avatar` and `title`; `nature` and `vibe` are written into `SOUL.md`          |
| Document templates       | `IDENTITY.md` is removed from the claw template set and runtime prompt assumptions                            |

## Review Note

- The `plan-document-reviewer` subagent workflow referenced by the skill is not available in this environment.
- Perform human review of this plan file before execution, then choose either `superpowers:subagent-driven-development` or `superpowers:executing-plans`.
