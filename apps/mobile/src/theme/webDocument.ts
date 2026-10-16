import { useEffect } from 'react';
import { Platform } from 'react-native';

import type { Theme } from './tokens';

const STYLE_ID = 'bojo-theme-css';

/**
 * Web only: keeps <html>/<body> colours, `color-scheme` and the browser theme-color in sync with the
 * app theme, and installs keyboard-only focus rings (:focus-visible) for every focusable element.
 * Touches `document` only inside an effect (never at module load — A8).
 */
export function useWebDocumentTheme(theme: Theme): void {
  const { background, text, primaryText } = theme.colors;
  const { scheme } = theme;

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const root = document.documentElement;
    root.style.colorScheme = scheme;
    root.style.backgroundColor = background;
    document.body.style.backgroundColor = background;
    document.body.style.color = text;

    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = background;

    let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }
    style.textContent = [
      'html, body { -webkit-tap-highlight-color: transparent; }',
      ':focus { outline: none; }',
      `:focus-visible { outline: 2px solid ${primaryText} !important; outline-offset: 2px; }`,
      // Chips: the 44 pt hit box is transparent around a 36 pt pill — draw the ring on the pill.
      '[data-hit="pill"]:focus-visible { outline: none !important; }',
      `[data-hit="pill"]:focus-visible > div { outline: 2px solid ${primaryText}; outline-offset: 2px; }`,
      // Skip links stay off-screen until a keyboard user focuses them.
      '[data-skip-link]:not(:focus) { position: absolute !important; width: 1px !important; height: 1px !important; min-height: 0 !important; padding: 0 !important; margin: -1px !important; border: 0 !important; overflow: hidden !important; clip-path: inset(50%) !important; white-space: nowrap !important; }',
      // Text inputs draw their own focus border.
      'input:focus-visible, textarea:focus-visible { outline: none !important; }',
    ].join('\n');
  }, [scheme, background, text, primaryText]);
}
