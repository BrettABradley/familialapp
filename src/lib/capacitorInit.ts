import { Capacitor } from '@capacitor/core';

export async function initCapacitorPlugins() {
  if (Capacitor.isNativePlatform()) {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setOverlaysWebView({ overlay: true });
    await StatusBar.setStyle({ style: Style.Light });

    const { Keyboard } = await import('@capacitor/keyboard');

    Keyboard.addListener('keyboardWillShow', (info) => {
      document.documentElement.style.setProperty(
        '--keyboard-height',
        `${info.keyboardHeight}px`
      );
      const visualHeight = window.innerHeight - info.keyboardHeight;
      document.documentElement.style.setProperty(
        '--visual-viewport-height',
        `${visualHeight}px`
      );
      document.documentElement.classList.add('keyboard-open');
    });

    Keyboard.addListener('keyboardWillHide', () => {
      document.documentElement.style.setProperty('--keyboard-height', '0px');
      document.documentElement.style.setProperty(
        '--visual-viewport-height',
        `${window.innerHeight}px`
      );
      document.documentElement.classList.remove('keyboard-open');
    });
  }
}
