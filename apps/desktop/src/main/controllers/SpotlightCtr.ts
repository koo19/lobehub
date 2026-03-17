import { ipcMain, screen } from 'electron';

import { BrowsersIdentifiers } from '@/appBrowsers';

import { ControllerModule, IpcMethod, shortcut } from './index';

export default class SpotlightCtr extends ControllerModule {
  static override readonly groupName = 'spotlight';

  private blurAttached = false;
  private crashRecoveryAttached = false;

  afterAppReady() {
    // Listen for renderer ready signal (invoke → handle)
    ipcMain.handle('spotlight:ready', () => {
      const spotlight = this.app.browserManager.browsers.get(BrowsersIdentifiers.spotlight);
      spotlight?.markReady();
    });

    // Listen for renderer hide request
    ipcMain.handle('spotlight:hide', () => {
      const spotlight = this.app.browserManager.browsers.get(BrowsersIdentifiers.spotlight);
      spotlight?.hide();
    });

    // Listen for renderer resize request
    ipcMain.handle('spotlight:resize', (_event, params: { height: number; width: number }) => {
      const spotlight = this.app.browserManager.browsers.get(BrowsersIdentifiers.spotlight);
      if (!spotlight) return;

      const currentBounds = spotlight.browserWindow.getBounds();
      spotlight.browserWindow.setBounds(
        {
          height: params.height,
          width: params.width,
          x: currentBounds.x,
          y: currentBounds.y,
        },
        true,
      );
    });
  }

  @shortcut('showSpotlight')
  async toggleSpotlight() {
    // Use retrieveByIdentifier to auto-create if not yet initialized (e.g. after onboarding)
    const spotlight = this.app.browserManager.retrieveByIdentifier(BrowsersIdentifiers.spotlight);

    // Lazy-attach blur and crash recovery on first access
    this.ensureBlurHandler(spotlight);
    this.ensureCrashRecovery(spotlight);

    if (spotlight.browserWindow.isVisible()) {
      spotlight.hide();
      return;
    }

    await spotlight.whenReady();

    const cursor = screen.getCursorScreenPoint();
    spotlight.showAt(cursor);

    spotlight.broadcast('spotlightFocus');
  }

  @IpcMethod()
  async resize(params: { height: number; width: number }) {
    const spotlight = this.app.browserManager.browsers.get(BrowsersIdentifiers.spotlight);
    if (!spotlight) return;

    const currentBounds = spotlight.browserWindow.getBounds();
    spotlight.browserWindow.setBounds(
      {
        height: params.height,
        width: params.width,
        x: currentBounds.x,
        y: currentBounds.y,
      },
      true,
    );
  }

  @IpcMethod()
  async hide() {
    const spotlight = this.app.browserManager.browsers.get(BrowsersIdentifiers.spotlight);
    spotlight?.hide();
  }

  private ensureBlurHandler(
    spotlight: ReturnType<typeof this.app.browserManager.retrieveByIdentifier>,
  ) {
    if (this.blurAttached) return;
    this.blurAttached = true;

    spotlight.browserWindow.on('blur', () => {
      if (spotlight.browserWindow.isVisible()) {
        spotlight.hide();
      }
    });
  }

  private ensureCrashRecovery(
    spotlight: ReturnType<typeof this.app.browserManager.retrieveByIdentifier>,
  ) {
    if (this.crashRecoveryAttached) return;
    this.crashRecoveryAttached = true;

    spotlight.browserWindow.webContents.on('render-process-gone', () => {
      console.error('[SpotlightCtr] Spotlight renderer crashed, reloading...');
      spotlight.resetReady();
      // Reload instead of destroy+recreate — Browser.destroy() doesn't truly
      // destroy the BrowserWindow or remove it from BrowserManager's map.
      spotlight.loadUrl(spotlight.options.path).catch((e) => {
        console.error('[SpotlightCtr] Failed to reload after crash:', e);
      });
    });
  }
}
