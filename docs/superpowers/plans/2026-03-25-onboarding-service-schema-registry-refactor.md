# Onboarding Service Schema + Registry Refactor

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 10 duplicate normalize functions and 6 switch statements with a schema-driven normalizer and a node handler registry, cutting \~300 lines and making new-node addition a single schema entry.

**Architecture:** Define each node's fields (name, type, required?) in a declarative schema object. A generic `normalizeFromSchema` function replaces all 10 hand-rolled normalizers. A `NodeHandler` registry maps each node to its commit logic (where to write in state, side effects), replacing all switch-based dispatch. The `OnboardingService` class delegates to registry lookups instead of switch statements.

**Tech Stack:** TypeScript, Vitest (existing tests serve as regression suite)

---

## File Structure

| File                                                             | Responsibility                                                                                                                                                                          |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/server/services/onboarding/nodeSchema.ts` **(create)**      | Field schema definitions per node, generic `normalizeFromSchema` function, `getScopedPatch`/`getMissingFields`/`getNodeDraftState` driven by schema                                     |
| `src/server/services/onboarding/nodeHandlers.ts` **(create)**    | `NodeHandler` interface, handler registry keyed by node, each handler owns: `draftKey`, `commitToState`, optional `sideEffects`                                                         |
| `src/server/services/onboarding/index.ts` **(modify)**           | Remove all 10 `normalize*` functions, 6 switch helpers, `NODE_FIELDS`, `REQUIRED_FIELDS_BY_NODE`. Import from new files. Simplify `commitActiveStep` to \~20 lines via registry lookup. |
| `src/server/services/onboarding/nodeSchema.test.ts` **(create)** | Unit tests for `normalizeFromSchema` and schema-derived helpers                                                                                                                         |
| `src/server/services/onboarding/index.test.ts` **(keep)**        | Existing 17 tests serve as regression — must all pass after refactor                                                                                                                    |

---

### Task 1: Create `nodeSchema.ts` — field schemas and generic normalizer

**Files:**

- Create: `src/server/services/onboarding/nodeSchema.ts`
- Create: `src/server/services/onboarding/nodeSchema.test.ts`

The schema describes each profile node's fields. Two special nodes (`responseLanguage`, `summary`) have no object fields. The generic normalizer replaces all 10 hand-written functions.

- [ ] **Step 1: Write failing tests for `normalizeFromSchema`**

```ts
// nodeSchema.test.ts
import { describe, expect, it } from 'vitest';

import { NODE_SCHEMAS, getNodeDraftState, normalizeFromSchema } from './nodeSchema';

describe('normalizeFromSchema', () => {
  it('returns undefined for empty input in committed mode', () => {
    expect(normalizeFromSchema('agentIdentity', {}, 'committed')).toBeUndefined();
  });

  it('returns partial draft with only provided string fields', () => {
    const result = normalizeFromSchema('agentIdentity', { vibe: 'warm' }, 'draft');
    expect(result).toEqual({ vibe: 'warm' });
  });

  it('returns undefined for draft when no valid fields present', () => {
    expect(normalizeFromSchema('agentIdentity', { unknown: 'x' }, 'draft')).toBeUndefined();
  });

  it('returns committed only when all required fields present', () => {
    const full = { emoji: '🦊', name: 'Fox', nature: 'AI pal', vibe: 'sharp' };
    expect(normalizeFromSchema('agentIdentity', full, 'committed')).toEqual(full);
  });

  it('returns undefined for committed when required field missing', () => {
    expect(
      normalizeFromSchema(
        'agentIdentity',
        { emoji: '🦊', name: 'Fox', vibe: 'sharp' },
        'committed',
      ),
    ).toBeUndefined();
  });

  it('trims string values and drops empty strings', () => {
    const result = normalizeFromSchema(
      'userIdentity',
      { summary: '  hello  ', name: '  ' },
      'draft',
    );
    expect(result).toEqual({ summary: 'hello' });
  });

  it('handles string array fields with sanitization', () => {
    const result = normalizeFromSchema(
      'workContext',
      { summary: 'ctx', tools: ['  vim  ', '', 'emacs'] },
      'draft',
    );
    expect(result).toEqual({ summary: 'ctx', tools: ['vim', 'emacs'] });
  });

  it('slices string arrays to max 8 items', () => {
    const tools = Array.from({ length: 12 }, (_, i) => `tool-${i}`);
    const result = normalizeFromSchema('workContext', { summary: 'ctx', tools }, 'draft');
    expect(result!.tools).toHaveLength(8);
  });
});

describe('getNodeDraftState', () => {
  it('returns empty status with missing fields when draft is empty', () => {
    const state = getNodeDraftState('agentIdentity', {});
    expect(state).toEqual({
      missingFields: ['emoji', 'name', 'nature', 'vibe'],
      status: 'empty',
    });
  });

  it('returns complete when all required fields present', () => {
    const state = getNodeDraftState('userIdentity', { userIdentity: { summary: 'hi' } });
    expect(state?.status).toBe('complete');
  });

  it('returns undefined for summary node', () => {
    expect(getNodeDraftState('summary', {})).toBeUndefined();
  });

  it('handles responseLanguage as scalar', () => {
    expect(getNodeDraftState('responseLanguage', { responseLanguage: 'zh-CN' })?.status).toBe(
      'complete',
    );
    expect(getNodeDraftState('responseLanguage', {})?.status).toBe('empty');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bunx vitest run --silent='passed-only' src/server/services/onboarding/nodeSchema.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `nodeSchema.ts`**

```ts
// nodeSchema.ts
import type { UserAgentOnboardingDraft, UserAgentOnboardingNode } from '@lobechat/types';

type FieldType = 'string' | 'string[]';

interface FieldDef {
  maxItems?: number;
  required?: boolean;
  type: FieldType;
}

export interface NodeSchema {
  fields: Record<string, FieldDef>;
}

interface NodeDraftState {
  missingFields?: string[];
  status: 'complete' | 'empty' | 'partial';
}

const s = (required = false): FieldDef => ({ required, type: 'string' });
const sa = (maxItems = 8): FieldDef => ({ maxItems, type: 'string[]' });

export const NODE_SCHEMAS: Partial<Record<UserAgentOnboardingNode, NodeSchema>> = {
  agentIdentity: {
    fields: {
      emoji: s(true),
      name: s(true),
      nature: s(true),
      vibe: s(true),
    },
  },
  painPoints: {
    fields: {
      blockedBy: sa(),
      frustrations: sa(),
      noTimeFor: sa(),
      summary: s(true),
    },
  },
  userIdentity: {
    fields: {
      domainExpertise: s(),
      name: s(),
      professionalRole: s(),
      summary: s(true),
    },
  },
  workContext: {
    fields: {
      activeProjects: sa(),
      currentFocus: s(),
      interests: sa(),
      summary: s(true),
      thisQuarter: s(),
      thisWeek: s(),
      tools: sa(),
    },
  },
  workStyle: {
    fields: {
      communicationStyle: s(),
      decisionMaking: s(),
      socialMode: s(),
      summary: s(true),
      thinkingPreferences: s(),
      workStyle: s(),
    },
  },
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const sanitizeText = (value?: string) => value?.trim() || undefined;

const sanitizeTextList = (items?: unknown[], max = 8) =>
  (items ?? [])
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, max);

export const normalizeFromSchema = (
  node: UserAgentOnboardingNode,
  raw: unknown,
  mode: 'committed' | 'draft',
): Record<string, unknown> | undefined => {
  const schema = NODE_SCHEMAS[node];
  if (!schema) return undefined;

  const patch = isRecord(raw) ? raw : undefined;
  if (!patch) return undefined;

  const result: Record<string, unknown> = {};

  for (const [key, def] of Object.entries(schema.fields)) {
    if (def.type === 'string') {
      const value = sanitizeText(typeof patch[key] === 'string' ? patch[key] : undefined);
      if (value) result[key] = value;
    } else {
      const value = sanitizeTextList(
        Array.isArray(patch[key]) ? patch[key] : undefined,
        def.maxItems,
      );
      if (value.length > 0) result[key] = value;
    }
  }

  if (Object.keys(result).length === 0) return undefined;

  if (mode === 'committed') {
    const requiredFields = Object.entries(schema.fields)
      .filter(([, def]) => def.required)
      .map(([key]) => key);

    for (const key of requiredFields) {
      const value = result[key];
      if (value === undefined) return undefined;
      if (Array.isArray(value) && value.length === 0) return undefined;
      if (typeof value === 'string' && !value.trim()) return undefined;
    }
  }

  return result;
};

export const getScopedPatch = (
  node: UserAgentOnboardingNode,
  patch: Record<string, unknown>,
): Record<string, unknown> => {
  const schema = NODE_SCHEMAS[node];
  if (!schema) return {};

  const nestedPatch = isRecord(patch[node]) ? patch[node] : undefined;
  const result: Record<string, unknown> = {};

  for (const key of Object.keys(schema.fields)) {
    const value = patch[key] ?? nestedPatch?.[key];
    if (value !== undefined) result[key] = value;
  }

  return result;
};

export const getMissingFields = (
  node: UserAgentOnboardingNode,
  patch: Record<string, unknown>,
): string[] => {
  const schema = NODE_SCHEMAS[node];
  if (!schema) return [];

  return Object.entries(schema.fields)
    .filter(([, def]) => def.required)
    .map(([key]) => key)
    .filter((key) => {
      const value = patch[key];
      if (Array.isArray(value)) return value.length === 0;
      if (typeof value === 'string') return !value.trim();
      return value === undefined;
    });
};

export const getNodeDraftState = (
  node: UserAgentOnboardingNode | undefined,
  draft: UserAgentOnboardingDraft,
): NodeDraftState | undefined => {
  if (!node || node === 'summary') return undefined;

  if (node === 'responseLanguage') {
    return draft.responseLanguage
      ? { status: 'complete' }
      : { missingFields: ['responseLanguage'], status: 'empty' };
  }

  const currentDraft = draft[node];

  if (!currentDraft || Object.keys(currentDraft).length === 0) {
    const schema = NODE_SCHEMAS[node];
    const requiredFields = schema
      ? Object.entries(schema.fields)
          .filter(([, def]) => def.required)
          .map(([key]) => key)
      : [];
    return { missingFields: requiredFields, status: 'empty' };
  }

  const missingFields = getMissingFields(node, currentDraft as Record<string, unknown>);

  return {
    ...(missingFields.length > 0 ? { missingFields } : {}),
    status: missingFields.length === 0 ? 'complete' : 'partial',
  };
};

export { isRecord, sanitizeText };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bunx vitest run --silent='passed-only' src/server/services/onboarding/nodeSchema.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/services/onboarding/nodeSchema.ts src/server/services/onboarding/nodeSchema.test.ts
git commit -m "♻️ refactor(onboarding): add schema-driven normalizer for onboarding nodes"
```

---

### Task 2: Create `nodeHandlers.ts` — handler registry

**Files:**

- Create: `src/server/services/onboarding/nodeHandlers.ts`

Each handler encapsulates: how to extract a draft from a patch, how to merge into draft, how to read from draft, how to commit to state, and optional side effects. This replaces `mergeDraftForNode`, `getDraftValueForNode`, `extractDraftForNode`, and the giant `commitActiveStep` switch.

- [ ] **Step 1: Implement `nodeHandlers.ts`**

```ts
// nodeHandlers.ts
import type {
  UserAgentOnboarding,
  UserAgentOnboardingDraft,
  UserAgentOnboardingNode,
} from '@lobechat/types';

import { getScopedPatch, isRecord, normalizeFromSchema, sanitizeText } from './nodeSchema';

type OnboardingPatchInput = Record<string, unknown>;

type DraftKey = keyof Omit<UserAgentOnboardingDraft, 'responseLanguage'>;

interface CommitSideEffects {
  updateInterests?: string[];
  updateResponseLanguage?: string;
  updateUserName?: string;
}

export interface NodeHandler {
  commitToState: (
    state: UserAgentOnboarding,
    draft: UserAgentOnboardingDraft,
  ) => { sideEffects?: CommitSideEffects; success: boolean; errorMessage?: string };
  extractDraft: (patch: OnboardingPatchInput) => Partial<UserAgentOnboardingDraft> | undefined;
  getDraftValue: (draft: UserAgentOnboardingDraft) => unknown;
  mergeDraft: (draft: UserAgentOnboardingDraft, patch: unknown) => UserAgentOnboardingDraft;
  readonly draftKey: DraftKey | 'responseLanguage';
}

const makeProfileNodeHandler = (
  node: UserAgentOnboardingNode,
  draftKey: DraftKey,
  commitTarget:
    | { key: 'agentIdentity' }
    | {
        key: 'profile';
        profileKey: string;
        extraProfile?: (committed: Record<string, unknown>) => Record<string, unknown>;
      },
  sideEffectsFn?: (committed: Record<string, unknown>) => CommitSideEffects | undefined,
): NodeHandler => ({
  draftKey,
  commitToState: (state, draft) => {
    const committed = normalizeFromSchema(node, draft[draftKey], 'committed') as
      | Record<string, unknown>
      | undefined;
    if (!committed) {
      return { success: false, errorMessage: `${node} has not been captured yet.` };
    }

    if (commitTarget.key === 'agentIdentity') {
      state.agentIdentity = committed as UserAgentOnboarding['agentIdentity'];
    } else {
      state.profile = {
        ...state.profile,
        [commitTarget.profileKey]: committed,
        ...commitTarget.extraProfile?.(committed),
      };
    }

    return {
      sideEffects: sideEffectsFn?.(committed),
      success: true,
    };
  },
  extractDraft: (patch) => {
    const scopedPatch = getScopedPatch(node, patch);
    const normalized = normalizeFromSchema(node, scopedPatch, 'draft');
    return normalized
      ? ({ [draftKey]: normalized } as Partial<UserAgentOnboardingDraft>)
      : undefined;
  },
  getDraftValue: (draft) => draft[draftKey],
  mergeDraft: (draft, patch) => {
    const patchRecord = isRecord(patch) ? patch : {};
    return { ...draft, [draftKey]: { ...draft[draftKey], ...patchRecord } };
  },
});

const responseLanguageHandler: NodeHandler = {
  draftKey: 'responseLanguage',
  commitToState: (state, draft) => {
    if (draft.responseLanguage === undefined) {
      return { success: false, errorMessage: 'Response language has not been captured yet.' };
    }
    return {
      sideEffects: { updateResponseLanguage: draft.responseLanguage },
      success: true,
    };
  },
  extractDraft: (patch) => {
    const responseLanguage = sanitizeText(
      typeof patch.responseLanguage === 'string' ? patch.responseLanguage : undefined,
    );
    return responseLanguage ? { responseLanguage } : undefined;
  },
  getDraftValue: (draft) => draft.responseLanguage,
  mergeDraft: (draft, patch) => ({ ...draft, responseLanguage: patch as string }),
};

export const NODE_HANDLERS: Partial<Record<UserAgentOnboardingNode, NodeHandler>> = {
  agentIdentity: makeProfileNodeHandler('agentIdentity', 'agentIdentity', { key: 'agentIdentity' }),
  painPoints: makeProfileNodeHandler('painPoints', 'painPoints', {
    key: 'profile',
    profileKey: 'painPoints',
  }),
  responseLanguage: responseLanguageHandler,
  userIdentity: makeProfileNodeHandler(
    'userIdentity',
    'userIdentity',
    {
      key: 'profile',
      profileKey: 'identity',
    },
    (committed) => (committed.name ? { updateUserName: committed.name as string } : undefined),
  ),
  workContext: makeProfileNodeHandler(
    'workContext',
    'workContext',
    {
      key: 'profile',
      profileKey: 'workContext',
      extraProfile: (committed) => ({
        ...(committed.currentFocus ||
        committed.thisWeek ||
        committed.thisQuarter ||
        committed.summary
          ? {
              currentFocus:
                (committed.currentFocus as string) ||
                (committed.thisWeek as string) ||
                (committed.thisQuarter as string) ||
                (committed.summary as string),
            }
          : {}),
        interests: Array.isArray(committed.interests)
          ? (committed.interests as string[])
          : undefined,
      }),
    },
    (committed) =>
      Array.isArray(committed.interests) && committed.interests.length > 0
        ? { updateInterests: committed.interests as string[] }
        : undefined,
  ),
  workStyle: makeProfileNodeHandler('workStyle', 'workStyle', {
    key: 'profile',
    profileKey: 'workStyle',
  }),
};

export const PROFILE_DOCUMENT_NODES = new Set<UserAgentOnboardingNode>([
  'agentIdentity',
  'userIdentity',
  'workStyle',
  'workContext',
  'painPoints',
]);
```

- [ ] **Step 2: Commit**

```bash
git add src/server/services/onboarding/nodeHandlers.ts
git commit -m "♻️ refactor(onboarding): add node handler registry for onboarding steps"
```

---

### Task 3: Refactor `index.ts` — wire up schema + registry, remove old code

**Files:**

- Modify: `src/server/services/onboarding/index.ts`

This is the main integration. Remove \~300 lines of old normalize functions, switch helpers, and inline constants. Replace with imports from `nodeSchema.ts` and `nodeHandlers.ts`.

- [ ] **Step 1: Remove old type aliases and constants (lines 31-131)**

Delete these blocks from `index.ts`:

- Type aliases: `OnboardingAgentIdentity`, `OnboardingDraft*`, `OnboardingPainPoints`, `OnboardingUserIdentity`, `OnboardingWorkContext`, `OnboardingWorkStyle` (lines 31-43)
- `NODE_FIELDS` constant (lines 100-121)
- `REQUIRED_FIELDS_BY_NODE` constant (lines 123-130)
- `OnboardingNodeDraftState` interface (lines 132-135) — now in `nodeSchema.ts`

Keep: `OnboardingPatchInput`, `OnboardingError`, `CommitStepResult`, `ProposePatchResult`, `AskQuestionResult` types.

- [ ] **Step 2: Remove all 10 normalize functions (lines 204-401)**

Delete: `normalizeAgentIdentityDraft`, `normalizeAgentIdentity`, `normalizeUserIdentityDraft`, `normalizeUserIdentity`, `normalizeWorkStyleDraft`, `normalizeWorkStyle`, `normalizeWorkContextDraft`, `normalizeWorkContext`, `normalizePainPointsDraft`, `normalizePainPoints`.

Also delete the standalone utility functions that are now in `nodeSchema.ts`:

- `sanitizeText` (line 81)

- `sanitizeTextList` (lines 83-87)

- `isRecord` (lines 92-93)

- `asString` (line 95)

- `asStringArray` (lines 97-98)

- `getScopedPatch` (lines 176-188)

- `getMissingFields` (lines 190-202)

- `getNodeDraftState` (lines 499-528)

- [ ] **Step 3: Remove the 4 switch-based helpers (lines 404-497)**

Delete: `mergeDraftForNode`, `getDraftValueForNode`, `extractDraftForNode`.

- [ ] **Step 4: Add imports from new modules**

```ts
import { NODE_HANDLERS, PROFILE_DOCUMENT_NODES } from './nodeHandlers';
import { getNodeDraftState, getScopedPatch, getMissingFields } from './nodeSchema';
```

- [ ] **Step 5: Rewrite `proposeSinglePatch` to use registry**

Replace the body of `proposeSinglePatch` to use `NODE_HANDLERS[activeNode]` for `extractDraft`, `getDraftValue`, `mergeDraft` instead of the old switch-based functions.

Key change: replace `extractDraftForNode(activeNode, params.patch)` → `handler.extractDraft(params.patch)`, `getDraftValueForNode(...)` → `handler.getDraftValue(draft)`, `mergeDraftForNode(...)` → `handler.mergeDraft(draft, draftValue)`.

- [ ] **Step 6: Rewrite `commitActiveStep` to use registry**

Replace the giant switch with:

```ts
private commitActiveStep = async (
  state: UserAgentOnboarding,
  activeNode: UserAgentOnboardingNode,
): Promise<CommitStepResult> => {
  const draft = state.draft ?? {};

  if (activeNode === 'summary') {
    return {
      content: 'Use finishOnboarding from the summary step.',
      control: buildOnboardingControl({
        activeNode,
        currentQuestion:
          state.questionSurface?.node === activeNode ? state.questionSurface.question : undefined,
      }),
      success: false,
    };
  }

  const handler = NODE_HANDLERS[activeNode];
  if (!handler) {
    return {
      content: `Unknown node "${activeNode}".`,
      control: buildOnboardingControl({ activeNode }),
      success: false,
    };
  }

  const commitResult = handler.commitToState(state, draft);

  if (!commitResult.success) {
    return {
      content: commitResult.errorMessage ?? `${activeNode} has not been captured yet.`,
      control: buildOnboardingControl({
        activeNode,
        activeNodeDraftState: getNodeDraftState(activeNode, draft),
        currentQuestion:
          state.questionSurface?.node === activeNode ? state.questionSurface.question : undefined,
      }),
      success: false,
    };
  }

  // Apply side effects
  if (commitResult.sideEffects?.updateUserName) {
    await this.userModel.updateUser({ fullName: commitResult.sideEffects.updateUserName });
  }
  if (commitResult.sideEffects?.updateInterests) {
    await this.userModel.updateUser({ interests: commitResult.sideEffects.updateInterests });
  }
  if (commitResult.sideEffects?.updateResponseLanguage) {
    const currentSettings = await this.userModel.getUserSettings();
    await this.userModel.updateSetting({
      general: merge(currentSettings?.general || {}, {
        responseLanguage: commitResult.sideEffects.updateResponseLanguage,
      }),
    });
  }

  // Advance state
  const nextNode = getNextNode(activeNode);
  const completedNodes = dedupeNodes([...(state.completedNodes ?? []), activeNode]);
  const nextDraft = { ...draft };
  delete nextDraft[handler.draftKey as keyof typeof nextDraft];

  await this.saveState({ ...state, completedNodes, draft: nextDraft });

  if (PROFILE_DOCUMENT_NODES.has(activeNode)) {
    try {
      await this.upsertInboxDocuments(state, activeNode === 'agentIdentity');
    } catch (error) {
      console.error('[OnboardingService] Failed to upsert inbox documents:', error);
    }
  }

  const nextContext = await this.getState();

  return {
    content: nextNode
      ? `Committed step "${activeNode}". Continue with "${nextNode}".`
      : `Committed step "${activeNode}".`,
    control: nextContext.control,
    currentQuestion: nextContext.currentQuestion,
    success: true,
  };
};
```

- [ ] **Step 7: Run existing regression tests**

Run: `bunx vitest run --silent='passed-only' src/server/services/onboarding/index.test.ts`
Expected: 17 tests PASS

- [ ] **Step 8: Run new schema tests**

Run: `bunx vitest run --silent='passed-only' src/server/services/onboarding/nodeSchema.test.ts`
Expected: PASS

- [ ] **Step 9: Typecheck**

Run: `bunx tsc --noEmit src/server/services/onboarding/index.ts src/server/services/onboarding/nodeSchema.ts src/server/services/onboarding/nodeHandlers.ts`
Expected: no new errors (pre-existing path-alias errors are acceptable)

- [ ] **Step 10: Commit**

```bash
git add src/server/services/onboarding/index.ts
git commit -m "♻️ refactor(onboarding): replace normalize functions and switch statements with schema + registry"
```

---

## Verification Checklist

After all tasks complete:

- [ ] All 17 existing tests pass
- [ ] New `nodeSchema.test.ts` tests pass
- [ ] No new TypeScript errors introduced
- [ ] `index.ts` is under 500 lines (from \~1480)
- [ ] Adding a new node requires only: (1) add schema entry in `nodeSchema.ts`, (2) add handler in `nodeHandlers.ts`

## What NOT to change

- `OnboardingService` class constructor and public API signatures — callers are unaffected
- `buildOnboardingControl`, `getActiveNode`, `getNextNode`, `getFirstIncompleteNode`, `dedupeNodes` — these small helpers are fine as-is
- `documentHelpers.ts` — unchanged
- Test file structure — only add new test file, do not restructure existing tests
