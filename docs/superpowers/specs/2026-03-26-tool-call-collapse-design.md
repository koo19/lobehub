# Tool Call Workflow Collapse — Unified UI Design

## Problem

In `AssistantGroup`, tool calls are rendered as individual `AccordionItem` cards across separate content blocks. For non-developer users this creates excessive visual noise. Additionally, when collapsed to a summary line, the visual style is completely disconnected from the expanded state — different layout, different information hierarchy, different component language.

## Design

### Collapse Boundary

The entire "working phase" of an assistant message is treated as one collapsible unit:

- **Starts at**: the first content block that contains a tool call
- **Ends before**: the final content block(s) that contain only text/images (the "answer")
- **Includes**: tool calls, intermediate short messages between tools, reasoning blocks

Blocks that are purely "answer" content (text/images at the end, after the last tool call) remain outside the collapsed unit.

### Collapsed State

A single-line summary bar, truncated with ellipsis if too long:

```
▼ Activated a skill, read a document, executed a script, ran a command, searched the web (2) · Thought for 2m 30s
```

- Chevron icon (▼ collapsed, ▲ expanded) on the left
- Tool actions aggregated by `apiName` using `toolDisplayNames` mapping, comma-separated
- Failed tools annotated inline: `executed a script (failed)`
- Reasoning total duration appended after `·` separator
- Status icon: `✓` (all success) or `⚠` (any error) — replaces chevron position
- Single line, `white-space: nowrap; overflow: hidden; text-overflow: ellipsis`
- Subtle background on hover (`rgba(255,255,255,0.03)` → `0.06`)

### Expanded State

A flat list inside a subtle container (`border-radius: 8px; background: rgba(255,255,255,0.02)`):

**Header**: same summary text as collapsed state, but with ▲ chevron. Click to collapse.

**List items** (in original block order):

1. **Tool line**: `{action} — {detail}`
   - Action: human-readable name from `toolDisplayNames`, colored by category (blue for read, purple for search, yellow for execute, red for error, green for write)
   - Separator: em dash `—` in muted color
   - Detail: first meaningful parameter value (file path, query string, URL, etc.)
   - Status suffix for non-success: `· failed`, `· aborted` in muted text
   - **Hover actions**: debug (bug icon), view result (list icon), delete (trash icon) — appear on right side only on hover

2. **Reasoning line**: `Thought for {duration}` in muted gray (`color: #444`)

3. **Intermediate message**: normal text rendering, slightly muted (`color: #bbb`), same indentation as tool lines

### During Execution (Streaming)

- No collapsed state — items render as flat list as they arrive
- Completed items show normally
- Currently executing item: spinner icon + present-tense action name ("Searching the web") + reduced opacity
- Container has subtle border hint (`border: 1px solid rgba(99,102,241,0.12)`)
- Auto-collapses when all tools complete (with animation)

### Summary Text Generation

Reuse existing `toolDisplayNames.ts` mapping. Aggregation logic:

- Group tools by `apiName`, count duplicates
- Format: `"{displayName}"` if count=1, `"{displayName} ({count})"` if count>1
- Join with `, `
- Append reasoning: `· Thought for {totalDuration}` (sum all reasoning durations)
- For errors: append `(failed)` after the specific tool's display name

### Auto-collapse Behavior

- **Trigger**: all non-pending tools have completed results (non-null, non-LOADING_FLAT)
- **Animation**: `motion/react` AnimatePresence, \~250ms ease-out
- **User override**: once user manually expands, never auto-collapse again for this message
- **Reset**: if new tool calls arrive (re-generation), reset to expanded streaming state
- **Initial load**: when entering a completed topic, start collapsed immediately

### Exceptions (Never Collapse Into Summary)

- Tools with `intervention?.status === 'pending'` (awaiting user approval) render independently outside the collapsed group
- Tools with `renderDisplayControl === 'alwaysExpand'` render independently

### Component Architecture

#### Changed Files

**`components/Group.tsx`** (modify)

- `groupBlocks()`: partition blocks into "working phase" (from first tool to last tool) and "answer phase" (trailing content-only blocks)
- Working phase blocks → `WorkflowCollapse` component
- Answer phase blocks → existing `GroupItem` rendering

**`components/ContentBlock.tsx`** — no changes

**`Tool/index.tsx`** — no changes to existing component; it will still be used for exception tools (pending/alwaysExpand)

#### New Files

**`components/WorkflowCollapse.tsx`** (new)

- Main collapse/expand orchestrator
- Props: `blocks: AssistantContentBlock[]`, `assistantId`, `contentId`, `disableEditing`, `messageIndex`
- Manages: collapsed state, auto-collapse logic, animation
- Renders: `WorkflowSummary` (collapsed) or `WorkflowExpandedList` (expanded)

**`components/WorkflowSummary.tsx`** (new)

- Single-line summary bar
- Props: `tools: ChatToolPayloadWithResult[]`, `reasoningDuration: number`, `hasError: boolean`, `onExpand: () => void`

**`components/WorkflowExpandedList.tsx`** (new)

- Flat list renderer for expanded state
- Iterates blocks in order, renders each as:
  - Tool block → `WorkflowToolLine` per tool
  - Content block → inline markdown text
  - Reasoning block → `WorkflowReasoningLine`

**`components/WorkflowToolLine.tsx`** (new)

- Single tool line: action + separator + detail + status + hover actions
- Props: tool payload, disableEditing, assistantMessageId
- Hover reveals action buttons (debug, view result, delete)

**`components/WorkflowReasoningLine.tsx`** (new)

- Muted gray line: "Thought for {duration}"
- Props: reasoning data

#### Files to Remove/Deprecate

**`ToolsSummary.tsx`** — replaced by `WorkflowSummary.tsx`
**`components/CollapsedToolBlocks.tsx`** — replaced by `WorkflowCollapse.tsx`

#### Files to Keep

**`toolDisplayNames.ts`** — reused for summary text generation
**`Tools.tsx`** — still used for exception tools (pending/alwaysExpand) that render outside the workflow collapse

### Edge Cases

| Case                               | Behavior                                                  |
| ---------------------------------- | --------------------------------------------------------- |
| No tool calls in message           | No workflow collapse, render normally                     |
| Single tool call                   | Still collapses to summary                                |
| All tools are alwaysExpand/pending | No workflow collapse, render as exceptions                |
| Tool with error                    | Included in collapsed group, marked `(failed)` in summary |
| Intermediate message between tools | Rendered as text line inside expanded list                |
| No reasoning blocks                | Summary omits `· Thought for...` suffix                   |
| Re-entering completed topic        | Start collapsed immediately                               |
| New tools arrive after collapse    | Reset to expanded streaming state                         |

## Scope

- Modifies `components/Group.tsx`
- Creates 5 new components in `components/`
- Removes `ToolsSummary.tsx` and `CollapsedToolBlocks.tsx`
- Keeps `toolDisplayNames.ts`, `Tools.tsx`, `Tool/` directory unchanged
- No schema/type changes, no backend changes
- No i18n initially (English mapping table, can migrate later)

## Visual Reference

Mockup: `.superpowers/brainstorm/11205-1774511566/content/full-mockup-v2.html`
