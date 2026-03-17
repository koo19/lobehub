# Electron Panel Native Addon Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `@lobechat/electron-panel` N-API addon that converts Spotlight's BrowserWindow into a floating NSPanel-like panel with native drag and animated resize.

**Architecture:** Monorepo package at `packages/electron-panel/` using `Napi::ObjectWrap<Panel>` pattern (mirroring `electron-liquid-glass`). Objective-C++ runtime property injection on NSWindow — no isa-swizzle. prebuildify for prebuilt binaries, node-gyp-build for runtime loading.

**Tech Stack:** N-API (node-addon-api), Objective-C++ (AppKit), prebuildify, node-gyp-build, TypeScript wrapper

**Spec:** `docs/superpowers/specs/2026-03-17-electron-panel-addon-design.md`

---

### Task 1: Package scaffold

**Files:**

- Create: `packages/electron-panel/package.json`

- Create: `packages/electron-panel/binding.gyp`

- Create: `packages/electron-panel/tsconfig.json`

- [ ] **Step 1: Create package.json**

```json
{
  "dependencies": {
    "node-addon-api": "^8.4.0"
  },
  "description": "NSPanel-grade native window behavior for Electron BrowserWindow",
  "exports": {
    ".": "./js/index.ts"
  },
  "gypfile": false,
  "main": "./js/index.ts",
  "name": "@lobechat/electron-panel",
  "optionalDependencies": {
    "node-gyp-build": "^4"
  },
  "os": ["darwin"],
  "private": true,
  "scripts": {
    "build:native": "prebuildify --napi --strip --tag-armv --arch=arm64 && prebuildify --napi --strip --arch=x64",
    "build:native:current": "node-gyp rebuild && mkdir -p prebuilds/darwin-$(uname -m) && cp build/Release/electron_panel.node prebuilds/darwin-$(uname -m)/node.napi.node"
  },
  "type": "module",
  "types": "./js/index.ts",
  "version": "1.0.0"
}
```

- [ ] **Step 2: Create binding.gyp**

```python
{
  "targets": [
    {
      "target_name": "electron_panel",
      "sources": [
        "src/panel.cc",
        "src/panel_mac.mm"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS"],
      "conditions": [
        ["OS=='mac'", {
          "defines": ["PLATFORM_OSX"],
          "xcode_settings": {
            "OTHER_CPLUSPLUSFLAGS": ["-std=c++17", "-ObjC++"],
            "OTHER_LDFLAGS": ["-framework AppKit", "-framework QuartzCore"]
          }
        }]
      ]
    }
  ]
}
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["js/**/*.ts"]
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/electron-panel/
git commit -m "✨ feat(electron-panel): scaffold package with binding.gyp and config"
```

---

### Task 2: Objective-C++ native layer

**Files:**

- Create: `packages/electron-panel/src/panel_mac.mm`

This file implements all three native functions: panelize, native drag, and animated resize.

- [ ] **Step 1: Create panel_mac.mm with panelize**

```objc
#ifdef PLATFORM_OSX
#import <AppKit/AppKit.h>
#import <QuartzCore/QuartzCore.h>
#import <objc/runtime.h>
#include <cstdio>

// Key for the drag overlay view associated with the window
static const void *kDragViewKey = &kDragViewKey;

#define RUN_ON_MAIN(block)                           \
  if ([NSThread isMainThread]) {                     \
    block();                                         \
  } else {                                           \
    dispatch_sync(dispatch_get_main_queue(), block); \
  }

// ---------------------------------------------------------------------------
// DragView — transparent overlay that intercepts mouse events for window drag
// ---------------------------------------------------------------------------
@interface PanelDragView : NSView
@end

@implementation PanelDragView

- (BOOL)acceptsFirstMouse:(NSEvent *)event {
  return YES;
}

- (void)mouseDown:(NSEvent *)event {
  [self.window performWindowDragWithEvent:event];
}

// Allow click-through for non-drag interactions
- (NSView *)hitTest:(NSPoint)point {
  // Only intercept if the point is within our frame
  NSPoint local = [self convertPoint:point fromView:self.superview];
  if (NSPointInRect(local, self.bounds)) {
    return self;
  }
  return nil;
}

@end

// ---------------------------------------------------------------------------
// panelize — set NSPanel-grade properties on an NSWindow
// ---------------------------------------------------------------------------
extern "C" bool panelize(unsigned char *buffer) {
  if (!buffer) return false;

  __block bool success = false;

  RUN_ON_MAIN(^{
    NSView *rootView = *reinterpret_cast<NSView **>(buffer);
    if (!rootView) return;

    NSWindow *window = [rootView window];
    if (!window) return;

    // Set floating panel behavior
    if ([window respondsToSelector:@selector(setFloatingPanel:)]) {
      [(id)window setFloatingPanel:YES];
    }

    // Only become key when needed (don't steal focus from other apps)
    if ([window respondsToSelector:@selector(setBecomesKeyOnlyIfNeeded:)]) {
      [(id)window setBecomesKeyOnlyIfNeeded:YES];
    }

    // Don't hide when app deactivates
    if ([window respondsToSelector:@selector(setHidesOnDeactivate:)]) {
      [window setHidesOnDeactivate:NO];
    }

    // Collection behavior: join all spaces + fullscreen auxiliary
    window.collectionBehavior |=
        NSWindowCollectionBehaviorCanJoinAllSpaces |
        NSWindowCollectionBehaviorFullScreenAuxiliary;

    // Float above normal windows
    window.level = NSFloatingWindowLevel;

    success = true;
  });

  return success;
}

// ---------------------------------------------------------------------------
// enableNativeDrag — add a transparent drag overlay at the specified rect
// ---------------------------------------------------------------------------
extern "C" bool enableNativeDrag(unsigned char *buffer,
                                  double x, double y,
                                  double width, double height) {
  if (!buffer) return false;

  __block bool success = false;

  RUN_ON_MAIN(^{
    NSView *rootView = *reinterpret_cast<NSView **>(buffer);
    if (!rootView) return;

    NSWindow *window = [rootView window];
    if (!window) return;

    NSView *contentView = window.contentView;
    if (!contentView) return;

    // Remove existing drag view if any
    NSView *oldDrag = objc_getAssociatedObject(contentView, kDragViewKey);
    if (oldDrag) {
      [oldDrag removeFromSuperview];
    }

    // macOS coordinate system is bottom-left origin.
    // The rect from JS is top-left origin (web convention).
    // Convert: flipped_y = contentHeight - y - height
    NSRect contentBounds = contentView.bounds;
    double flippedY = contentBounds.size.height - y - height;
    NSRect dragRect = NSMakeRect(x, flippedY, width, height);

    PanelDragView *dragView = [[PanelDragView alloc] initWithFrame:dragRect];
    // Auto-resize: stick to top, resize width with window
    dragView.autoresizingMask = NSViewWidthSizable | NSViewMinYMargin;

    [contentView addSubview:dragView positioned:NSWindowAbove relativeTo:nil];
    objc_setAssociatedObject(contentView, kDragViewKey, dragView,
                             OBJC_ASSOCIATION_RETAIN);

    success = true;
  });

  return success;
}

// ---------------------------------------------------------------------------
// disableNativeDrag — remove the drag overlay
// ---------------------------------------------------------------------------
extern "C" bool disableNativeDrag(unsigned char *buffer) {
  if (!buffer) return false;

  __block bool success = false;

  RUN_ON_MAIN(^{
    NSView *rootView = *reinterpret_cast<NSView **>(buffer);
    if (!rootView) return;

    NSWindow *window = [rootView window];
    if (!window) return;

    NSView *contentView = window.contentView;
    if (!contentView) return;

    NSView *dragView = objc_getAssociatedObject(contentView, kDragViewKey);
    if (dragView) {
      [dragView removeFromSuperview];
      objc_setAssociatedObject(contentView, kDragViewKey, nil,
                               OBJC_ASSOCIATION_ASSIGN);
    }

    success = true;
  });

  return success;
}

// ---------------------------------------------------------------------------
// animateResize — smoothly animate window to a new frame
// ---------------------------------------------------------------------------
extern "C" bool animateResize(unsigned char *buffer,
                               double x, double y,
                               double width, double height,
                               double duration) {
  if (!buffer) return false;

  __block bool success = false;

  RUN_ON_MAIN(^{
    NSView *rootView = *reinterpret_cast<NSView **>(buffer);
    if (!rootView) return;

    NSWindow *window = [rootView window];
    if (!window) return;

    NSRect newFrame = NSMakeRect(x, y, width, height);

    if (duration <= 0) {
      [window setFrame:newFrame display:YES];
    } else {
      [NSAnimationContext runAnimationGroup:^(NSAnimationContext *ctx) {
        ctx.duration = duration;
        ctx.timingFunction = [CAMediaTimingFunction
            functionWithName:kCAMediaTimingFunctionEaseInEaseOut];
        [[window animator] setFrame:newFrame display:YES];
      }];
    }

    success = true;
  });

  return success;
}

#endif // PLATFORM_OSX
```

- [ ] **Step 2: Commit**

```bash
git add packages/electron-panel/src/panel_mac.mm
git commit -m "✨ feat(electron-panel): Objective-C++ native layer — panelize, drag, animateResize"
```

---

### Task 3: N-API binding layer

**Files:**

- Create: `packages/electron-panel/src/panel.cc`

- [ ] **Step 1: Create panel.cc**

```cpp
#include <napi.h>

#ifdef __APPLE__
extern "C" bool panelize(unsigned char *buffer);
extern "C" bool enableNativeDrag(unsigned char *buffer,
                                  double x, double y,
                                  double width, double height);
extern "C" bool disableNativeDrag(unsigned char *buffer);
extern "C" bool animateResize(unsigned char *buffer,
                               double x, double y,
                               double width, double height,
                               double duration);
#endif

class Panel : public Napi::ObjectWrap<Panel> {
public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports) {
    Napi::Function func = DefineClass(env, "Panel", {
      InstanceMethod("panelize", &Panel::Panelize),
      InstanceMethod("enableNativeDrag", &Panel::EnableNativeDrag),
      InstanceMethod("disableNativeDrag", &Panel::DisableNativeDrag),
      InstanceMethod("animateResize", &Panel::AnimateResize),
    });

    Napi::FunctionReference *constructor = new Napi::FunctionReference();
    *constructor = Napi::Persistent(func);
    env.SetInstanceData(constructor);

    exports.Set("Panel", func);
    return exports;
  }

  // Constructor: receives Buffer from getNativeWindowHandle()
  Panel(const Napi::CallbackInfo &info)
      : Napi::ObjectWrap<Panel>(info), handle_(nullptr) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsBuffer()) {
      Napi::TypeError::New(env,
        "Expected first argument to be a Buffer from getNativeWindowHandle()")
        .ThrowAsJavaScriptException();
      return;
    }

    auto buffer = info[0].As<Napi::Buffer<unsigned char>>();
    // Store a copy of the handle data (pointer-sized)
    size_t len = buffer.Length();
    handle_ = new unsigned char[len];
    memcpy(handle_, buffer.Data(), len);
  }

  ~Panel() {
    delete[] handle_;
  }

private:
  unsigned char *handle_;

  Napi::Value Panelize(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();
#ifdef __APPLE__
    bool ok = panelize(handle_);
    return Napi::Boolean::New(env, ok);
#else
    return Napi::Boolean::New(env, false);
#endif
  }

  Napi::Value EnableNativeDrag(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsObject()) {
      Napi::TypeError::New(env, "Expected {x, y, width, height}")
        .ThrowAsJavaScriptException();
      return env.Null();
    }

    auto rect = info[0].As<Napi::Object>();
    double x = rect.Get("x").As<Napi::Number>().DoubleValue();
    double y = rect.Get("y").As<Napi::Number>().DoubleValue();
    double w = rect.Get("width").As<Napi::Number>().DoubleValue();
    double h = rect.Get("height").As<Napi::Number>().DoubleValue();

#ifdef __APPLE__
    bool ok = enableNativeDrag(handle_, x, y, w, h);
    return Napi::Boolean::New(env, ok);
#else
    return Napi::Boolean::New(env, false);
#endif
  }

  Napi::Value DisableNativeDrag(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();
#ifdef __APPLE__
    bool ok = disableNativeDrag(handle_);
    return Napi::Boolean::New(env, ok);
#else
    return Napi::Boolean::New(env, false);
#endif
  }

  Napi::Value AnimateResize(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsObject()) {
      Napi::TypeError::New(env, "Expected {x, y, width, height}")
        .ThrowAsJavaScriptException();
      return env.Null();
    }

    auto frame = info[0].As<Napi::Object>();
    double x = frame.Get("x").As<Napi::Number>().DoubleValue();
    double y = frame.Get("y").As<Napi::Number>().DoubleValue();
    double w = frame.Get("width").As<Napi::Number>().DoubleValue();
    double h = frame.Get("height").As<Napi::Number>().DoubleValue();

    double duration = 0.2;
    if (info.Length() >= 2 && info[1].IsNumber()) {
      duration = info[1].As<Napi::Number>().DoubleValue();
    }

#ifdef __APPLE__
    bool ok = animateResize(handle_, x, y, w, h, duration);
    return Napi::Boolean::New(env, ok);
#else
    return Napi::Boolean::New(env, false);
#endif
  }
};

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  return Panel::Init(env, exports);
}

NODE_API_MODULE(electron_panel, Init)
```

- [ ] **Step 2: Commit**

```bash
git add packages/electron-panel/src/panel.cc
git commit -m "✨ feat(electron-panel): N-API binding layer with ObjectWrap<Panel>"
```

---

### Task 4: TypeScript wrapper

**Files:**

- Create: `packages/electron-panel/js/index.ts`

- [ ] **Step 1: Create js/index.ts**

```typescript
import path from 'node:path';

export interface Rect {
  height: number;
  width: number;
  x: number;
  y: number;
}

interface NativePanel {
  animateResize(frame: Rect, duration: number): boolean;
  disableNativeDrag(): boolean;
  enableNativeDrag(rect: Rect): boolean;
  panelize(): boolean;
}

interface NativeBinding {
  Panel: new (handle: Buffer) => NativePanel;
}

function loadNative(): NativeBinding | null {
  if (process.platform !== 'darwin') return null;

  try {
    // Use node-gyp-build to locate the correct prebuilt binary
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const gypBuild = require('node-gyp-build');
    return gypBuild(path.join(__dirname, '..'));
  } catch {
    try {
      // Fallback: try build/Release directly (development)
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('../build/Release/electron_panel.node');
    } catch {
      console.warn(
        '[@lobechat/electron-panel] Failed to load native addon — panel features disabled.',
      );
      return null;
    }
  }
}

const native = loadNative();

export class Panel {
  private _addon: NativePanel | null;

  constructor(handle: Buffer) {
    if (!Buffer.isBuffer(handle)) {
      throw new Error('[@lobechat/electron-panel] handle must be a Buffer');
    }

    if (native) {
      this._addon = new native.Panel(handle);
    } else {
      this._addon = null;
    }
  }

  /**
   * Set NSPanel-grade properties: floatingPanel, becomesKeyOnlyIfNeeded,
   * hidesOnDeactivate:NO, canJoinAllSpaces, floatingWindowLevel.
   */
  panelize(): boolean {
    return this._addon?.panelize() ?? false;
  }

  /**
   * Add a transparent native drag overlay at the given rect (top-left origin).
   * Replaces -webkit-app-region: drag with native performWindowDragWithEvent.
   */
  enableNativeDrag(rect: Rect): boolean {
    return this._addon?.enableNativeDrag(rect) ?? false;
  }

  /**
   * Remove the native drag overlay.
   */
  disableNativeDrag(): boolean {
    return this._addon?.disableNativeDrag() ?? false;
  }

  /**
   * Animate window to a new frame with easeInOut timing.
   * @param frame Target frame {x, y, width, height} in screen coordinates.
   * @param duration Animation duration in seconds (default 0.2).
   */
  animateResize(frame: Rect, duration = 0.2): boolean {
    return this._addon?.animateResize(frame, duration) ?? false;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/electron-panel/js/
git commit -m "✨ feat(electron-panel): TypeScript wrapper with platform-safe loading"
```

---

### Task 5: Build and verify native module loads

**Files:**

- Modify: `packages/electron-panel/package.json` (install deps if needed)

- [ ] **Step 1: Install dependencies and build**

```bash
cd packages/electron-panel
pnpm install
node-gyp configure
node-gyp build
```

Run: verify `build/Release/electron_panel.node` exists.

- [ ] **Step 2: Verify module loads in Node**

```bash
node -e "const m = require('./build/Release/electron_panel.node'); console.log('Exports:', Object.keys(m)); console.log('Panel:', typeof m.Panel);"
```

Expected output:

```
Exports: [ 'Panel' ]
Panel: function
```

- [ ] **Step 3: Copy to prebuilds for dev**

```bash
mkdir -p prebuilds/darwin-$(uname -m)
cp build/Release/electron_panel.node prebuilds/darwin-$(uname -m)/node.napi.node
```

- [ ] **Step 4: Commit prebuilds**

```bash
git add packages/electron-panel/build/ packages/electron-panel/prebuilds/
git commit -m "🔧 build(electron-panel): compile native module and add prebuilt"
```

---

### Task 6: Register in native-deps and integrate with build

**Files:**

- Modify: `apps/desktop/native-deps.config.mjs:34-38`

- [ ] **Step 1: Add @lobechat/electron-panel to nativeModules**

In `apps/desktop/native-deps.config.mjs`, add to the darwin array:

```javascript
export const nativeModules = [
  // macOS-only native modules
  ...(isDarwin
    ? ['node-mac-permissions', 'electron-liquid-glass', '@lobechat/electron-panel']
    : []),
  '@napi-rs/canvas',
  // Add more native modules here as needed
];
```

- [ ] **Step 2: Verify dependency resolution**

```bash
cd apps/desktop
node -e "import('./native-deps.config.mjs').then(m => console.log(m.getAllDependencies().filter(d => d.includes('electron-panel'))))"
```

Expected: `['@lobechat/electron-panel']`

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/native-deps.config.mjs
git commit -m "🔧 build(desktop): register @lobechat/electron-panel in native-deps"
```

---

### Task 7: Integrate panelize into SpotlightCtr

**Files:**

- Modify: `apps/desktop/src/main/controllers/SpotlightCtr.ts`

- Modify: `apps/desktop/src/main/core/browser/Browser.ts:176-179`

- [ ] **Step 1: Add Panel import and initialization in SpotlightCtr**

In `apps/desktop/src/main/controllers/SpotlightCtr.ts`, add:

```typescript
import { Panel } from '@lobechat/electron-panel';
```

Add a private field:

```typescript
private panel?: Panel;
private panelInitialized = false;
```

Add initialization method:

```typescript
private initializePanel(
  spotlight: ReturnType<typeof this.app.browserManager.retrieveByIdentifier>,
) {
  if (this.panelInitialized) return;
  this.panelInitialized = true;

  try {
    const handle = spotlight.browserWindow.getNativeWindowHandle();
    this.panel = new Panel(handle);
    this.panel.panelize();
    this.panel.enableNativeDrag({ x: 0, y: 0, width: 680, height: 44 });
  } catch (e) {
    console.error('[SpotlightCtr] Failed to initialize native panel:', e);
  }
}
```

- [ ] **Step 2: Call initializePanel in toggleSpotlight**

In the `toggleSpotlight` method, after `await spotlight.whenReady()`, add:

```typescript
this.initializePanel(spotlight);
```

- [ ] **Step 3: Remove redundant Electron panel settings from Browser.ts**

In `apps/desktop/src/main/core/browser/Browser.ts`, the spotlight panel behavior block (lines 176-179) is now handled by the native addon. Remove:

```typescript
// Spotlight: panel behavior
if (this.identifier === 'spotlight') {
  browserWindow.setAlwaysOnTop(true, 'floating');
  browserWindow.setHiddenInMissionControl(true);
  browserWindow.setVisibleOnAllWorkspaces(true);
}
```

Note: `setHiddenInMissionControl` is NOT handled by the native addon (it's Electron-specific). Keep it or add it to panelize. For safety, keep only `setHiddenInMissionControl`:

```typescript
// Spotlight: hide from Mission Control (Electron-specific API)
if (this.identifier === 'spotlight') {
  browserWindow.setHiddenInMissionControl(true);
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/main/controllers/SpotlightCtr.ts apps/desktop/src/main/core/browser/Browser.ts
git commit -m "✨ feat(spotlight): integrate native Panel addon — panelize + native drag"
```

---

### Task 8: Integrate animateResize into spotlight resize

**Files:**

- Modify: `apps/desktop/src/main/controllers/SpotlightCtr.ts`

- [ ] **Step 1: Replace setBounds with animateResize in the resize IPC handler**

In the `spotlight:resize` handler and the `resize` IPC method, replace `spotlight.browserWindow.setBounds(newBounds, true)` with `this.panel?.animateResize(...)`.

Note: `animateResize` takes screen coordinates (macOS bottom-left origin). Electron's `getBounds()` returns screen coordinates already (top-left origin on macOS for Electron). The native `setFrame:display:animate:` expects macOS screen coords (bottom-left). We need to convert.

Actually, Electron's `getBounds()` already returns screen-level coordinates that account for macOS coordinate system internally. But `NSWindow.setFrame` uses macOS native coords (bottom-left origin). We need to convert y:

```
macOS_y = screen_height - electron_y - window_height
```

However, this gets complex. A simpler approach: use Electron's `setBounds` for positioning (which handles coordinate conversion) and only use `animateResize` for the animation aspect. OR, do the conversion in the Obj-C++ layer.

**Revised approach:** Add a helper in panel_mac.mm that takes Electron-style bounds (top-left origin) and converts internally. Actually, the simplest approach is to keep using `NSWindow.frame` (which is already in native coords) and just do offset math in native code.

**Simplest approach for now:** In the resize handler, get current native frame from the window, compute delta, and set new frame. But this adds complexity.

**Pragmatic approach:** For the initial integration, use `animateResize` only when expanding/collapsing (height change) since that's where animation matters most. Pass Electron bounds through, and in the Obj-C++ layer, read the window's current screen and convert.

Let me simplify: keep `setBounds` for now but add an optional `animate` parameter that uses native animation. We'll address this in a focused follow-up.

**Updated Step 1:** Replace `setBounds` calls to use Panel's animateResize with coordinate conversion.

In SpotlightCtr, update the `resize` method:

```typescript
@IpcMethod()
async resize(params: { height: number; width: number }) {
  const spotlight = this.app.browserManager.browsers.get(BrowsersIdentifiers.spotlight);
  if (!spotlight) return;

  const currentBounds = spotlight.browserWindow.getBounds();
  const newBounds = {
    height: params.height,
    width: params.width,
    x: currentBounds.x,
    y: currentBounds.y,
  };

  if (spotlight.expandDirection === 'up' && params.height > currentBounds.height) {
    newBounds.y = currentBounds.y - (params.height - currentBounds.height);
  }

  // Use native animated resize if panel addon is available
  if (this.panel) {
    // Convert Electron screen coords (top-left) to macOS screen coords (bottom-left)
    const { screen } = await import('electron');
    const display = screen.getDisplayNearestPoint({ x: newBounds.x, y: newBounds.y });
    const screenHeight = display.bounds.y + display.bounds.height;
    const macY = screenHeight - newBounds.y - newBounds.height;

    this.panel.animateResize(
      { x: newBounds.x, y: macY, width: newBounds.width, height: newBounds.height },
      0.15,
    );
  } else {
    spotlight.browserWindow.setBounds(newBounds, true);
  }
}
```

Also update the `spotlight:resize` ipcMain handler similarly (or better: remove the duplicate handler and use only the IpcMethod).

- [ ] **Step 2: Remove the duplicate spotlight:resize ipcMain.handle**

In `afterAppReady()`, the `spotlight:resize` handler duplicates the `resize` IpcMethod. Remove it (the renderer should use the IpcMethod via the standard invoke pattern).

If the renderer currently calls `spotlight:resize` directly, keep both for now and mark the old one as deprecated.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/main/controllers/SpotlightCtr.ts
git commit -m "✨ feat(spotlight): use native animateResize for smooth expand/collapse"
```

---

### Task 9: Manual verification

- [ ] **Step 1: Start the desktop app in dev mode**

```bash
cd apps/desktop
bun run dev
```

- [ ] **Step 2: Verify panelize behavior**

Trigger Spotlight (hotkey). Verify:

- Window floats above all windows

- Window does not hide when clicking another app

- Window visible on all Spaces (switch Space and re-trigger)

- [ ] **Step 3: Verify native drag**

- Click and drag on the top 44px of the Spotlight window

- Verify smooth window drag without flicker

- [ ] **Step 4: Verify animated resize**

- Type a query to trigger chat expansion

- Verify smooth animated height change (not instant jump)

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -u
git commit -m "🐛 fix(electron-panel): post-verification adjustments"
```
