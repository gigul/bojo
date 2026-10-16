// Types `t()` keys against the Russian resources (the source of truth, ARCHITECTURE §2.5).
// A key missing from locales/ru/<ns>.json is a compile error; `npm run lint` also checks ru/pl/en parity.
import 'i18next';

import type { DEFAULT_NS, Resources } from './resources';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: typeof DEFAULT_NS;
    resources: Resources;
    returnNull: false;
  }
}
