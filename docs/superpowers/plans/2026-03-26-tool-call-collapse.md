# Tool Call Workflow Collapse — Unified UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current AccordionItem-based tool call rendering with a unified workflow collapse that groups the entire "working phase" (tools + intermediate messages + reasoning) into one collapsible unit with a Claude Code–style flat list UI.

**Architecture:** Modify `Group.tsx` to partition blocks into "working phase" (first tool → last tool, inclusive of interleaved content/reasoning) and "answer phase" (trailing content-only blocks). The working phase renders via a new `WorkflowCollapse` component that manages collapse state and renders either a summary bar or a flat expanded list. Each item type (tool, reasoning, message) gets its own lightweight line component.

**Tech Stack:** React 19, motion/react (AnimatePresence), @lobehub/ui, antd-style, zustand, lucide-react

**Spec:** `docs/superpowers/specs/2026-03-26-tool-call-collapse-design.md`

---

## File Structure

| File                                   | Action | Responsibility                                                            |
| -------------------------------------- | ------ | ------------------------------------------------------------------------- |
| `toolDisplayNames.ts`                  | Modify | Add `getWorkflowSummaryText()` with reasoning duration + error annotation |
| `components/WorkflowCollapse.tsx`      | Create | Collapse/expand orchestrator with auto-collapse logic                     |
| `components/WorkflowSummary.tsx`       | Create | Single-line summary bar (collapsed state header)                          |
| `components/WorkflowExpandedList.tsx`  | Create | Flat list renderer iterating blocks in order                              |
| `components/WorkflowToolLine.tsx`      | Create | Single tool line with hover actions                                       |
| `components/WorkflowReasoningLine.tsx` | Create | Muted "Thought for Xs" line                                               |
| `components/Group.tsx`                 | Modify | Replace `groupBlocks()` with working/answer phase partitioning            |
| `ToolsSummary.tsx`                     | Delete | Replaced by WorkflowSummary                                               |
| `components/CollapsedToolBlocks.tsx`   | Delete | Replaced by WorkflowCollapse                                              |

All new files live in `src/features/Conversation/Messages/AssistantGroup/components/`.

---

### Task 1: Extend toolDisplayNames with workflow summary helpers

**Files:**

- Modify: `src/features/Conversation/Messages/AssistantGroup/toolDisplayNames.ts`

- [ ] **Step 1: Add `getToolFirstDetail()` helper**

This extracts the first meaningful parameter value from a tool's arguments for display in the flat list.

Add after the existing `hasToolError` function:

```ts
/**
 * Extract the first meaningful parameter value from tool arguments for display.
 * Returns the first string value, truncated to 80 chars.
 */
export const getToolFirstDetail = (tool: ChatToolPayloadWithResult): string => {
  try {
    const args = JSON.parse(tool.arguments || '{}');
    const values = Object.values(args);
    for (const val of values) {
      if (typeof val === 'string' && val.trim()) {
        return val.length > 80 ? val.slice(0, 80) + '...' : val;
      }
    }
  } catch {
    // arguments still streaming or invalid
  }
  return '';
};
```

- [ ] **Step 2: Add `formatReasoningDuration()` helper**

Add after `getToolFirstDetail`:

```ts
/**
 * Format reasoning duration in milliseconds to human-readable string.
 * e.g. 1500 → "1s", 66000 → "1m 6s", 150000 → "2m 30s"
 */
export const formatReasoningDuration = (ms: number): string => {
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
};
```

- [ ] **Step 3: Add `getWorkflowSummaryText()` that includes error annotations and reasoning**

Add after `formatReasoningDuration`:

```ts
import { type AssistantContentBlock } from '@/types/index';

/**
 * Generate workflow summary text from blocks.
 * Includes tool aggregation with error annotations + reasoning duration.
 * Example: "Activated a skill, read a document, executed a script (failed), searched the web (2) · Thought for 2m 30s"
 */
export const getWorkflowSummaryText = (blocks: AssistantContentBlock[]): string => {
  // Collect all tools
  const tools = blocks.flatMap((b) => b.tools ?? []);

  // Group by apiName, track errors per group
  const groups = new Map<string, { count: number; errorCount: number }>();
  for (const tool of tools) {
    const existing = groups.get(tool.apiName) || { count: 0, errorCount: 0 };
    existing.count++;
    if (tool.result?.error) existing.errorCount++;
    groups.set(tool.apiName, existing);
  }

  // Build tool parts
  const toolParts: string[] = [];
  for (const [apiName, { count, errorCount }] of groups) {
    let part = getToolDisplayName(apiName);
    if (count > 1) part += ` (${count})`;
    if (errorCount > 0) part += ' (failed)';
    toolParts.push(part);
  }

  let result = toolParts.join(', ');

  // Sum reasoning durations
  const totalReasoningMs = blocks.reduce((sum, b) => sum + (b.reasoning?.duration ?? 0), 0);
  if (totalReasoningMs > 0) {
    result += ` · Thought for ${formatReasoningDuration(totalReasoningMs)}`;
  }

  return result;
};
```

Note: The `AssistantContentBlock` import needs to be added at the top of the file. Move the existing `ChatToolPayloadWithResult` import and add:

```ts
import { type ChatToolPayloadWithResult } from '@lobechat/types';

import { type AssistantContentBlock } from '@/types/index';
```

- [ ] **Step 4: Commit**

```bash
git add src/features/Conversation/Messages/AssistantGroup/toolDisplayNames.ts
git commit -m "feat(tools): add workflow summary helpers with reasoning duration and error annotations"
```

---

### Task 2: Create WorkflowReasoningLine component

**Files:**

- Create: `src/features/Conversation/Messages/AssistantGroup/components/WorkflowReasoningLine.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { type ModelReasoning } from '@lobechat/types';
import { memo } from 'react';

import { formatReasoningDuration } from '../toolDisplayNames';

interface WorkflowReasoningLineProps {
  reasoning: ModelReasoning;
}

const WorkflowReasoningLine = memo<WorkflowReasoningLineProps>(({ reasoning }) => {
  const duration = reasoning.duration ?? 0;
  if (duration === 0) return null;

  return (
    <div
      style={{
        color: '#555',
        fontSize: 13,
        padding: '4px 12px 4px 8px',
      }}
    >
      Thought for {formatReasoningDuration(duration)}
    </div>
  );
});

WorkflowReasoningLine.displayName = 'WorkflowReasoningLine';

export default WorkflowReasoningLine;
```

- [ ] **Step 2: Commit**

```bash
git add src/features/Conversation/Messages/AssistantGroup/components/WorkflowReasoningLine.tsx
git commit -m "feat(tools): add WorkflowReasoningLine component"
```

---

### Task 3: Create WorkflowToolLine component

**Files:**

- Create: `src/features/Conversation/Messages/AssistantGroup/components/WorkflowToolLine.tsx`

- [ ] **Step 1: Create the component with hover actions**

```tsx
import { type ChatToolPayloadWithResult } from '@lobechat/types';
import { ActionIcon } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { LucideBug, Rows3, Trash2 } from 'lucide-react';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useConversationStore } from '../../../../store';
import { getToolDisplayName, getToolFirstDetail } from '../toolDisplayNames';

const useStyles = createStaticStyles(({ css, cssVar }) => ({
  actions: css`
    display: none;
    align-items: center;
    gap: 2px;
    margin-left: auto;
    flex-shrink: 0;
  `,
  root: css`
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px 5px 8px;
    font-size: 13px;
    border-radius: 6px;
    transition: background 0.1s;

    &:hover {
      background: rgba(255, 255, 255, 0.04);
    }

    &:hover .workflow-tool-actions {
      display: flex;
    }
  `,
}));

interface WorkflowToolLineProps {
  assistantMessageId: string;
  disableEditing?: boolean;
  tool: ChatToolPayloadWithResult;
}

const WorkflowToolLine = memo<WorkflowToolLineProps>(
  ({ tool, assistantMessageId, disableEditing }) => {
    const { t } = useTranslation('plugin');
    const deleteAssistantMessage = useConversationStore((s) => s.deleteAssistantMessage);
    const [showDebug, setShowDebug] = useState(false);

    const displayName = getToolDisplayName(tool.apiName);
    const detail = getToolFirstDetail(tool);
    const hasError = !!tool.result?.error;
    const isAborted = tool.intervention?.status === 'aborted';

    // Color by status
    let actionColor = '#6cabf7'; // default blue (read)
    if (hasError)
      actionColor = '#f87171'; // red
    else if (tool.apiName.includes('search') || tool.apiName.includes('crawl'))
      actionColor = '#c084fc'; // purple
    else if (
      tool.apiName.includes('exec') ||
      tool.apiName.includes('run') ||
      tool.apiName.includes('activate')
    )
      actionColor = '#fbbf24'; // yellow
    else if (tool.apiName.includes('write') || tool.apiName.includes('create'))
      actionColor = '#34d399'; // green

    const statusSuffix = hasError ? '· failed' : isAborted ? '· aborted' : '';

    return (
      <div className={useStyles.root}>
        <span style={{ color: actionColor, flexShrink: 0 }}>{displayName}</span>
        {detail && (
          <>
            <span style={{ color: '#333', flexShrink: 0 }}>—</span>
            <span
              style={{
                color: '#888',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {detail}
            </span>
          </>
        )}
        {statusSuffix && (
          <span style={{ color: '#555', flexShrink: 0, fontSize: 12 }}>{statusSuffix}</span>
        )}

        {!disableEditing && (
          <div className={`workflow-tool-actions ${useStyles.actions}`}>
            <ActionIcon
              active={showDebug}
              icon={LucideBug}
              size={'small'}
              title={t(showDebug ? 'debug.off' : 'debug.on')}
              onClick={() => setShowDebug(!showDebug)}
            />
            <ActionIcon
              icon={Rows3}
              size={'small'}
              title={t('inspector.args')}
              onClick={() => {
                // TODO: implement view result in future iteration
              }}
            />
            <ActionIcon
              danger
              icon={Trash2}
              size={'small'}
              title={t('inspector.delete')}
              onClick={() => deleteAssistantMessage(assistantMessageId)}
            />
          </div>
        )}
      </div>
    );
  },
);

WorkflowToolLine.displayName = 'WorkflowToolLine';

export default WorkflowToolLine;
```

- [ ] **Step 2: Commit**

```bash
git add src/features/Conversation/Messages/AssistantGroup/components/WorkflowToolLine.tsx
git commit -m "feat(tools): add WorkflowToolLine component with hover actions"
```

---

### Task 4: Create WorkflowSummary component

**Files:**

- Create: `src/features/Conversation/Messages/AssistantGroup/components/WorkflowSummary.tsx`

- [ ] **Step 1: Create the summary bar**

```tsx
import { Icon } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { memo } from 'react';

interface WorkflowSummaryProps {
  expanded?: boolean;
  hasError: boolean;
  onToggle: () => void;
  summaryText: string;
}

const useStyles = createStaticStyles(({ css }) => ({
  root: css`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.15s;
    background: rgba(255, 255, 255, 0.03);
    overflow: hidden;

    &:hover {
      background: rgba(255, 255, 255, 0.06);
    }
  `,
  text: css`
    color: #888;
    font-size: 13px;
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  `,
}));

const WorkflowSummary = memo<WorkflowSummaryProps>(
  ({ summaryText, hasError, onToggle, expanded }) => {
    return (
      <div className={useStyles.root} onClick={onToggle}>
        {hasError ? (
          <Icon color="#fbbf24" icon={AlertTriangle} size={{ size: 14 }} />
        ) : (
          <Icon
            color="rgba(255,255,255,0.25)"
            icon={expanded ? ChevronUp : ChevronDown}
            size={{ size: 14 }}
          />
        )}
        <span className={useStyles.text}>{summaryText}</span>
        {hasError && (
          <Icon
            color="rgba(255,255,255,0.25)"
            icon={expanded ? ChevronUp : ChevronDown}
            size={{ size: 14 }}
          />
        )}
      </div>
    );
  },
);

WorkflowSummary.displayName = 'WorkflowSummary';

export default WorkflowSummary;
```

- [ ] **Step 2: Commit**

```bash
git add src/features/Conversation/Messages/AssistantGroup/components/WorkflowSummary.tsx
git commit -m "feat(tools): add WorkflowSummary single-line bar component"
```

---

### Task 5: Create WorkflowExpandedList component

**Files:**

- Create: `src/features/Conversation/Messages/AssistantGroup/components/WorkflowExpandedList.tsx`

- [ ] **Step 1: Create the flat list renderer**

This iterates blocks in order, rendering each block's content as appropriate line types.

```tsx
import { type AssistantContentBlock } from '@/types/index';

import { Flexbox } from '@lobehub/ui';
import { memo } from 'react';

import WorkflowReasoningLine from './WorkflowReasoningLine';
import WorkflowToolLine from './WorkflowToolLine';

interface WorkflowExpandedListProps {
  assistantId: string;
  blocks: AssistantContentBlock[];
  disableEditing?: boolean;
}

const WorkflowExpandedList = memo<WorkflowExpandedListProps>(
  ({ blocks, assistantId, disableEditing }) => {
    return (
      <Flexbox gap={0} style={{ padding: '4px 0 4px 12px' }}>
        {blocks.map((block) => {
          const items: React.ReactNode[] = [];

          // Reasoning line
          if (block.reasoning?.duration && block.reasoning.duration > 0) {
            items.push(
              <WorkflowReasoningLine key={`reasoning-${block.id}`} reasoning={block.reasoning} />,
            );
          }

          // Intermediate text content
          const hasContent = !!block.content && block.content.trim() !== '';
          if (hasContent) {
            items.push(
              <div
                key={`content-${block.id}`}
                style={{
                  color: '#bbb',
                  fontSize: 13,
                  lineHeight: 1.5,
                  padding: '6px 12px 6px 8px',
                }}
              >
                {block.content}
              </div>,
            );
          }

          // Tool lines
          if (block.tools && block.tools.length > 0) {
            for (const tool of block.tools) {
              items.push(
                <WorkflowToolLine
                  assistantMessageId={block.id}
                  disableEditing={disableEditing}
                  key={`tool-${tool.id}`}
                  tool={tool}
                />,
              );
            }
          }

          return items;
        })}
      </Flexbox>
    );
  },
);

WorkflowExpandedList.displayName = 'WorkflowExpandedList';

export default WorkflowExpandedList;
```

- [ ] **Step 2: Commit**

```bash
git add src/features/Conversation/Messages/AssistantGroup/components/WorkflowExpandedList.tsx
git commit -m "feat(tools): add WorkflowExpandedList flat list renderer"
```

---

### Task 6: Create WorkflowCollapse orchestrator component

**Files:**

- Create: `src/features/Conversation/Messages/AssistantGroup/components/WorkflowCollapse.tsx`

- [ ] **Step 1: Create the collapse/expand orchestrator**

```tsx
import { LOADING_FLAT } from '@lobechat/const';
import { type ChatToolPayloadWithResult } from '@lobechat/types';
import { AnimatePresence, m as motion } from 'motion/react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';

import { type AssistantContentBlock } from '@/types/index';

import { getWorkflowSummaryText, hasToolError } from '../toolDisplayNames';
import WorkflowExpandedList from './WorkflowExpandedList';
import WorkflowSummary from './WorkflowSummary';

interface WorkflowCollapseProps {
  assistantId: string;
  blocks: AssistantContentBlock[];
  disableEditing?: boolean;
}

const collectTools = (blocks: AssistantContentBlock[]): ChatToolPayloadWithResult[] => {
  return blocks.flatMap((b) => b.tools ?? []);
};

const areAllToolsComplete = (tools: ChatToolPayloadWithResult[]): boolean => {
  const collapsible = tools.filter((t) => t.intervention?.status !== 'pending');
  if (collapsible.length === 0) return false;
  return collapsible.every((t) => t.result != null && t.result.content !== LOADING_FLAT);
};

const WorkflowCollapse = memo<WorkflowCollapseProps>(({ blocks, assistantId, disableEditing }) => {
  const allTools = useMemo(() => collectTools(blocks), [blocks]);
  const allComplete = areAllToolsComplete(allTools);
  const summaryText = useMemo(() => getWorkflowSummaryText(blocks), [blocks]);
  const errorPresent = hasToolError(allTools);

  const [collapsed, setCollapsed] = useState(allComplete);
  const userExpandedRef = useRef(false);
  const prevToolCountRef = useRef(allTools.length);

  // Auto-collapse when all tools complete
  useEffect(() => {
    if (allComplete && !userExpandedRef.current && allTools.length > 0) {
      setCollapsed(true);
    }
  }, [allComplete, allTools.length]);

  // Reset collapse when new tools arrive (streaming / re-generation)
  useEffect(() => {
    if (allTools.length > prevToolCountRef.current) {
      setCollapsed(false);
      userExpandedRef.current = false;
    }
    prevToolCountRef.current = allTools.length;
  }, [allTools.length]);

  const handleToggle = () => {
    if (collapsed) {
      setCollapsed(false);
      userExpandedRef.current = true;
    } else {
      setCollapsed(true);
    }
  };

  return (
    <AnimatePresence initial={false} mode="wait">
      {collapsed ? (
        <motion.div
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          initial={{ height: 0, opacity: 0 }}
          key="workflow-collapsed"
          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        >
          <WorkflowSummary
            hasError={errorPresent}
            onToggle={handleToggle}
            summaryText={summaryText}
          />
        </motion.div>
      ) : (
        <motion.div
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          initial={{ height: 'auto', opacity: 1 }}
          key="workflow-expanded"
          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        >
          <div
            style={{
              background: 'rgba(255,255,255,0.02)',
              borderRadius: 8,
              overflow: 'hidden',
              ...(allComplete ? {} : { border: '1px solid rgba(99,102,241,0.12)' }),
            }}
          >
            {allComplete && (
              <WorkflowSummary
                expanded
                hasError={errorPresent}
                onToggle={handleToggle}
                summaryText={summaryText}
              />
            )}
            <WorkflowExpandedList
              assistantId={assistantId}
              blocks={blocks}
              disableEditing={disableEditing}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

WorkflowCollapse.displayName = 'WorkflowCollapse';

export default WorkflowCollapse;
```

- [ ] **Step 2: Commit**

```bash
git add src/features/Conversation/Messages/AssistantGroup/components/WorkflowCollapse.tsx
git commit -m "feat(tools): add WorkflowCollapse orchestrator with auto-collapse"
```

---

### Task 7: Modify Group.tsx to use working/answer phase partitioning

**Files:**

- Modify: `src/features/Conversation/Messages/AssistantGroup/components/Group.tsx`

- [ ] **Step 1: Replace the entire Group.tsx with new partitioning logic**

The new `partitionBlocks()` splits blocks into:

- **Working phase**: from first block with tools through last block with tools (inclusive of interleaved content/reasoning blocks)
- **Answer phase**: trailing blocks after the last tool block

```tsx
import { Flexbox } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import isEqual from 'fast-deep-equal';
import { memo, useMemo } from 'react';

import { type AssistantContentBlock } from '@/types/index';

import { messageStateSelectors, useConversationStore } from '../../../store';
import { MessageAggregationContext } from '../../Contexts/MessageAggregationContext';
import { CollapsedMessage } from './CollapsedMessage';
import GroupItem from './GroupItem';
import WorkflowCollapse from './WorkflowCollapse';

const styles = createStaticStyles(({ css }) => {
  return {
    container: css`
      &:has(.tool-blocks) {
        width: 100%;
      }
    `,
  };
});

interface GroupChildrenProps {
  blocks: AssistantContentBlock[];
  content?: string;
  contentId?: string;
  disableEditing?: boolean;
  id: string;
  messageIndex: number;
}

/**
 * Check if a block contains any tool calls.
 */
const hasTools = (block: AssistantContentBlock): boolean => {
  return !!block.tools && block.tools.length > 0;
};

/**
 * Partition blocks into "working phase" and "answer phase".
 *
 * Working phase: from first block with tools through last block with tools
 * (inclusive — interleaved content/reasoning blocks between tool blocks are included).
 *
 * Answer phase: all blocks after the last tool block.
 */
const partitionBlocks = (
  blocks: AssistantContentBlock[],
): { answerBlocks: AssistantContentBlock[]; workingBlocks: AssistantContentBlock[] } => {
  // Find index of last block that has tools
  let lastToolIndex = -1;
  for (let i = blocks.length - 1; i >= 0; i--) {
    if (hasTools(blocks[i])) {
      lastToolIndex = i;
      break;
    }
  }

  if (lastToolIndex === -1) {
    // No tool blocks at all
    return { answerBlocks: blocks, workingBlocks: [] };
  }

  // Find index of first block that has tools
  let firstToolIndex = 0;
  for (let i = 0; i < blocks.length; i++) {
    if (hasTools(blocks[i])) {
      firstToolIndex = i;
      break;
    }
  }

  // Blocks before first tool are "pre-answer" — render as normal GroupItems
  // Working phase: firstToolIndex through lastToolIndex (inclusive)
  // Answer phase: everything after lastToolIndex
  const preBlocks = blocks.slice(0, firstToolIndex);
  const workingBlocks = blocks.slice(firstToolIndex, lastToolIndex + 1);
  const answerBlocks = blocks.slice(lastToolIndex + 1);

  return {
    answerBlocks: [...preBlocks, ...answerBlocks],
    workingBlocks,
  };
};

const Group = memo<GroupChildrenProps>(
  ({ blocks, contentId, disableEditing, messageIndex, id, content }) => {
    const isCollapsed = useConversationStore(messageStateSelectors.isMessageCollapsed(id));
    const contextValue = useMemo(() => ({ assistantGroupId: id }), [id]);

    const { workingBlocks, answerBlocks } = useMemo(() => partitionBlocks(blocks), [blocks]);

    if (isCollapsed) {
      return (
        content && (
          <Flexbox>
            <CollapsedMessage content={content} id={id} />
          </Flexbox>
        )
      );
    }

    return (
      <MessageAggregationContext value={contextValue}>
        <Flexbox className={styles.container} gap={8}>
          {workingBlocks.length > 0 && (
            <WorkflowCollapse
              assistantId={id}
              blocks={workingBlocks}
              disableEditing={disableEditing}
            />
          )}
          {answerBlocks.map((item) => (
            <GroupItem
              {...item}
              assistantId={id}
              contentId={contentId}
              disableEditing={disableEditing}
              key={id + '.' + item.id}
              messageIndex={messageIndex}
            />
          ))}
        </Flexbox>
      </MessageAggregationContext>
    );
  },
  isEqual,
);

export default Group;
```

- [ ] **Step 2: Commit**

```bash
git add src/features/Conversation/Messages/AssistantGroup/components/Group.tsx
git commit -m "feat(tools): replace block grouping with working/answer phase partitioning"
```

---

### Task 8: Remove deprecated files

**Files:**

- Delete: `src/features/Conversation/Messages/AssistantGroup/ToolsSummary.tsx`

- Delete: `src/features/Conversation/Messages/AssistantGroup/components/CollapsedToolBlocks.tsx`

- [ ] **Step 1: Delete ToolsSummary.tsx**

```bash
rm src/features/Conversation/Messages/AssistantGroup/ToolsSummary.tsx
```

- [ ] **Step 2: Delete CollapsedToolBlocks.tsx**

```bash
rm src/features/Conversation/Messages/AssistantGroup/components/CollapsedToolBlocks.tsx
```

- [ ] **Step 3: Commit**

```bash
git add -u
git commit -m "refactor(tools): remove deprecated ToolsSummary and CollapsedToolBlocks"
```

---

### Task 9: Lint and type-check all changed files

- [ ] **Step 1: Run type check**

```bash
cd /Users/innei/.codex/worktrees/68f0/lobe-chat
bunx tsc --noEmit --pretty 2>&1 | grep -E "(Workflow|toolDisplayNames|Group\.tsx|CollapsedToolBlocks|ToolsSummary)" | head -30
```

Fix any type errors found.

- [ ] **Step 2: Run lint on changed files**

```bash
bunx eslint \
  src/features/Conversation/Messages/AssistantGroup/toolDisplayNames.ts \
  src/features/Conversation/Messages/AssistantGroup/components/WorkflowCollapse.tsx \
  src/features/Conversation/Messages/AssistantGroup/components/WorkflowSummary.tsx \
  src/features/Conversation/Messages/AssistantGroup/components/WorkflowExpandedList.tsx \
  src/features/Conversation/Messages/AssistantGroup/components/WorkflowToolLine.tsx \
  src/features/Conversation/Messages/AssistantGroup/components/WorkflowReasoningLine.tsx \
  src/features/Conversation/Messages/AssistantGroup/components/Group.tsx \
  --fix
```

Fix any lint errors.

- [ ] **Step 3: Commit fixes if any**

```bash
git add -u
git commit -m "fix: resolve lint and type issues in workflow collapse feature"
```
