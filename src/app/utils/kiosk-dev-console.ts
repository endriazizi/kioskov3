import { environment } from '../../environments/environment';

/** Log diagnostici (emoji ok) solo fuori da production — console totem pulita in campo. */
export function kioskDevLog(...args: unknown[]): void {
  if (!environment.production) console.log(...args);
}

export function kioskDevWarn(...args: unknown[]): void {
  if (!environment.production) console.warn(...args);
}

export function kioskDevInfo(...args: unknown[]): void {
  if (!environment.production) console.info(...args);
}
