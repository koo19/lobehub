# Desktop Cold Start Skeleton Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the desktop app's static centered brand splash with a fixed desktop shell skeleton that appears before React mounts and switches directly into the real UI.

**Architecture:** Keep the existing `#loading-screen` lifecycle in the desktop HTML entrypoint, but replace its markup and CSS so the first paint is a medium-fidelity desktop shell instead of a brand page. The implementation stays self-contained in `apps/desktop/index.html`, while validation checks the shell against the current desktop layout geometry and verifies the handoff remains direct and stable.

**Tech Stack:** Electron, electron-vite, static HTML/CSS, React SPA boot handoff

---

## File Map

| File | Responsibility |
| --- | --- |
| `apps/desktop/index.html` | Static cold-start HTML and CSS rendered before React mounts |
| `src/layout/SPAGlobalProvider/index.tsx` | Existing removal point for `#loading-screen`; reference only |
| `src/routes/(main)/_layout/index.tsx` | Reference for desktop main layout composition |
| `src/routes/(main)/_layout/DesktopLayoutContainer.tsx` | Reference for container padding, border radius, and border behavior |
| `src/features/NavPanel/components/NavPanelDraggable.tsx` | Reference for left panel width constraints |
| `docs/superpowers/specs/2026-03-17-desktop-cold-start-skeleton-design.md` | Approved design spec |

## Chunk 1: Lock Geometry And Startup Constraints

### Task 1: Verify the static shell targets the right layout anchors

**Files:**
- Modify: `docs/superpowers/plans/2026-03-17-desktop-cold-start-skeleton.md`
- Reference: `docs/superpowers/specs/2026-03-17-desktop-cold-start-skeleton-design.md`
- Reference: `src/routes/(main)/_layout/DesktopLayoutContainer.tsx`
- Reference: `src/features/NavPanel/components/NavPanelDraggable.tsx`

- [ ] **Step 1: Re-read the approved design and note the four required geometry anchors**

Read:
- `docs/superpowers/specs/2026-03-17-desktop-cold-start-skeleton-design.md`
- `src/routes/(main)/_layout/DesktopLayoutContainer.tsx`
- `src/features/NavPanel/components/NavPanelDraggable.tsx`

Expected notes:
- Left panel width relationship comes from the desktop nav panel constraints
- Main container uses the desktop outer padding system
- Main content panel needs matching radius/border/inset behavior
- Header and primary input area heights should feel consistent with the real home shell

- [ ] **Step 2: Confirm that this change stays in desktop static HTML only**

Check:
- `apps/desktop/index.html`
- `src/layout/SPAGlobalProvider/index.tsx`

Expected:
- `index.html` owns the cold-start shell
- `SPAGlobalProvider` still removes `#loading-screen`
- No route-level fallback files are in scope

- [ ] **Step 3: Commit the planning checkpoint if the plan changes materially**

Run:
```bash
git add docs/superpowers/plans/2026-03-17-desktop-cold-start-skeleton.md
git commit --no-verify -m "📝 docs: refine desktop cold start implementation plan"
```

Expected:
- Skip this commit if no material plan edits were needed during execution

## Chunk 2: Replace The Static Brand Splash

### Task 2: Convert `#loading-screen` into a desktop shell skeleton

**Files:**
- Modify: `apps/desktop/index.html`
- Reference: `src/routes/(main)/_layout/index.tsx`
- Reference: `src/routes/(main)/_layout/DesktopLayoutContainer.tsx`
- Reference: `src/features/NavPanel/components/NavPanelDraggable.tsx`
- Reference: `src/routes/(main)/home/_layout/index.tsx`

- [ ] **Step 1: Write the static shell structure directly inside `#loading-screen`**

Implement in `apps/desktop/index.html`:
- Replace the centered brand-only block with a two-column shell
- Keep a weak logo marker in the top-left of the left panel
- Add left-panel skeleton rows and a bottom account block
- Add a main content shell with header row, large input-like block, top card row, and lower neutral blocks

Expected:
- The DOM still uses the existing `#loading-screen` container
- The shell is visually recognizable as the desktop app, not as a splash screen

- [ ] **Step 2: Update the static CSS so the shell matches the desktop layout geometry**

Implement in `apps/desktop/index.html`:
- Keep full-screen fixed positioning for `#loading-screen`
- Replace brand-animation styles with shell layout styles
- Match the desktop shell to the main container's spacing and content inset relationship
- Use a fixed left rail width that fits within the real nav panel's default desktop range
- Give the main panel matching rounded corners and border layering

Expected:
- The shell geometry aligns closely to the real desktop layout at the container level
- No centered animated brand treatment remains

- [ ] **Step 3: Preserve theme-aware first paint behavior**

Implement in `apps/desktop/index.html`:
- Reuse the existing theme bootstrap logic
- Style the shell for both light and dark themes
- Ensure the weak brand marker inherits the active theme correctly

Expected:
- The shell does not flash the wrong theme on cold start

- [ ] **Step 4: Keep the handoff path unchanged**

Check:
- `src/layout/SPAGlobalProvider/index.tsx`

Expected:
- No code changes are required
- React still removes `#loading-screen` as soon as the app mounts

- [ ] **Step 5: Commit the implementation**

Run:
```bash
git add apps/desktop/index.html
git commit --no-verify -m "✨ feat: replace desktop cold start splash with shell skeleton"
```

Expected:
- One focused commit for the startup shell implementation

## Chunk 3: Verify Cold Start Behavior

### Task 3: Validate the direct handoff in a running desktop session

**Files:**
- Verify: `apps/desktop/index.html`
- Verify: `src/layout/SPAGlobalProvider/index.tsx`
- Manual: desktop app cold-start flow

- [ ] **Step 1: Start the desktop app in dev mode**

Run:
```bash
pnpm run dev:desktop
```

Expected:
- Electron app launches successfully
- The first visible frame is the desktop shell skeleton, not a centered brand splash

- [ ] **Step 2: Check cold start in both theme modes**

Manual verification:
- Launch with the current theme preference set to light
- Relaunch with the current theme preference set to dark

Expected:
- The shell colors track the active theme
- The shell still reads as an app layout in both themes

- [ ] **Step 3: Check the React handoff for visible jumping**

Manual verification:
- Observe the moment React replaces the static shell
- Compare left rail width, main panel inset, and panel radius relationship before and after mount

Expected:
- Direct switch, no fade
- No obvious layout jump at the shell level
- Small internal content differences are acceptable

- [ ] **Step 4: Record any acceptable deviations**

Document in the commit message body or follow-up note if needed:
- Minor mismatch from user-customized nav width
- Small platform-specific border differences

Expected:
- Any remaining mismatch is understood and intentionally accepted

- [ ] **Step 5: Run a targeted final diff check**

Run:
```bash
git diff --stat HEAD~1 HEAD
git status --short
```

Expected:
- Diff is limited to the intended startup-shell change
- No unrelated tracked files are left dirty

