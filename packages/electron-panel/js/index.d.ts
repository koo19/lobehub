export interface Rect {
  height: number;
  width: number;
  x: number;
  y: number;
}

export declare class Panel {
  constructor(handle: Buffer);

  /**
   * Set NSPanel-grade properties: floatingPanel, becomesKeyOnlyIfNeeded,
   * hidesOnDeactivate:NO, canJoinAllSpaces, floatingWindowLevel.
   */
  panelize(): boolean;

  /**
   * Add a transparent native drag overlay at the given rect (top-left origin).
   * Replaces -webkit-app-region: drag with native performWindowDragWithEvent.
   */
  enableNativeDrag(rect: Rect): boolean;

  /**
   * Remove the native drag overlay.
   */
  disableNativeDrag(): boolean;

  /**
   * Animate window to a new frame with easeInOut timing.
   * @param frame Target frame in macOS screen coordinates (bottom-left origin).
   * @param duration Animation duration in seconds (default 0.2).
   */
  animateResize(frame: Rect, duration?: number): boolean;

  /**
   * Animate window to a new frame, accepting Electron-style bounds (top-left origin).
   * Converts to macOS screen coordinates internally.
   * @param frame Target frame in Electron screen coordinates (top-left origin).
   * @param duration Animation duration in seconds (default 0.2).
   */
  animateResizeElectron(frame: Rect, duration?: number): boolean;
}
