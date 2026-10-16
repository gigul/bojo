// Minimal typing for the one react-dom API the web map uses (portals into maplibre DOM markers).
// `@types/react-dom` is not installed (wave-B agents can't add deps); if b1 adds it, delete this file.
declare module 'react-dom' {
  import type { ReactNode, ReactPortal } from 'react';

  export function createPortal(
    children: ReactNode,
    container: Element | DocumentFragment,
    key?: string | null,
  ): ReactPortal;
}
