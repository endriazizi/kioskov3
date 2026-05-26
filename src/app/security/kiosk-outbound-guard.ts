import { environment } from '../../environments/environment';

import type { KioskWhitelistService } from './kiosk-whitelist.service';

export type KioskBlockNotify = (message?: string) => void;

interface GuardState {
  whitelist: KioskWhitelistService;
  notifyBlocked: KioskBlockNotify;
  originalOpen: typeof window.open;
  originalAssign: (url: string | URL) => void;
  originalReplace: (url: string | URL) => void;
  locationAssignPatched: boolean;
  locationReplacePatched: boolean;
  originalLocationHrefSet: ((value: string) => void) | null;
  locationHrefPatched: boolean;
  originalBrowserOpen: ((options: { url: string }) => Promise<void>) | null;
  originalThemeableBrowserOpen: ((...args: unknown[]) => unknown) | null;
  mutationObserver: MutationObserver | null;
  clickHandler: (ev: MouseEvent) => void;
  auxClickHandler: (ev: MouseEvent) => void;
  submitHandler: (ev: Event) => void;
}

function locationPrototype(): Location {
  return Object.getPrototypeOf(window.location) as Location;
}

/**
 * Chrome/modern browsers: `window.location.assign = …` fallisce (read-only).
 * Patch best-effort su Location.prototype; se non possibile, restano click + href + window.open.
 */
function patchLocationNavMethod(
  method: 'assign' | 'replace',
  original: (url: string | URL) => void,
  whitelist: KioskWhitelistService,
  blockToast: () => void
): boolean {
  try {
    const locProto = locationPrototype();
    const desc = Object.getOwnPropertyDescriptor(locProto, method);
    if (!desc?.value) return false;
    Object.defineProperty(locProto, method, {
      configurable: true,
      writable: true,
      enumerable: desc.enumerable,
      value(url: string | URL) {
        const href = typeof url === 'string' ? url : url.toString();
        if (!whitelist.isAllowed(href)) {
          whitelist.recordBlocked('open', href, `location.${method}`);
          blockToast();
          return;
        }
        original.call(window.location, url);
      },
    });
    return true;
  } catch (e) {
    console.warn(`🔒 [Kiosk] location.${method} non patchabile (browser read-only):`, e);
    return false;
  }
}

function restoreLocationNavMethod(
  method: 'assign' | 'replace',
  original: (url: string | URL) => void
): void {
  try {
    const locProto = locationPrototype();
    const desc = Object.getOwnPropertyDescriptor(locProto, method);
    Object.defineProperty(locProto, method, {
      configurable: true,
      writable: true,
      enumerable: desc?.enumerable ?? true,
      value: original,
    });
  } catch {
    /* noop */
  }
}

let state: GuardState | null = null;

export function isKioskOutboundGuardActive(): boolean {
  return state != null;
}

/** Blocca navigazione verso browser di sistema / URL non consentiti (totem kiosk). */
export function installKioskOutboundGuard(
  whitelist: KioskWhitelistService,
  notifyBlocked: KioskBlockNotify = () => {}
): void {
  if (state) return;

  try {
    installKioskOutboundGuardCore(whitelist, notifyBlocked);
  } catch (e) {
    console.error('🔒 [Kiosk] install guard fallito — app avviata senza patch location:', e);
  }
}

function installKioskOutboundGuardCore(
  whitelist: KioskWhitelistService,
  notifyBlocked: KioskBlockNotify
): void {

  const originalOpen = window.open;
  const originalAssign = window.location.assign.bind(window.location);
  const originalReplace = window.location.replace.bind(window.location);

  const blockToast = () => notifyBlocked('Link non consentito in modalità kiosk.');

  const clickHandler = (ev: MouseEvent) => {
    if (ev.defaultPrevented || ev.button !== 0) return;

    const path = ev.composedPath ? (ev.composedPath() as HTMLElement[]) : [];
    let anchor: HTMLAnchorElement | null = null;

    for (const el of path as HTMLElement[]) {
      if (el?.tagName === 'A') {
        anchor = el as HTMLAnchorElement;
        break;
      }
    }
    if (!anchor) {
      let node = ev.target as HTMLElement | null;
      while (node && node !== document.body) {
        if (node instanceof HTMLAnchorElement) {
          anchor = node;
          break;
        }
        node = node.parentElement;
      }
    }
    if (!anchor) return;

    const href = anchor.getAttribute('href');
    if (!href || href.startsWith('#')) return;

    const lowerHref = href.trim().toLowerCase();
    if (
      lowerHref.startsWith('tel:') ||
      lowerHref.startsWith('mailto:') ||
      lowerHref.startsWith('sms:') ||
      lowerHref.startsWith('whatsapp:') ||
      lowerHref.startsWith('intent:') ||
      lowerHref.startsWith('javascript:')
    ) {
      ev.preventDefault();
      ev.stopPropagation();
      whitelist.recordBlocked('href', href, 'click schema esterno');
      blockToast();
      return;
    }

    if (!whitelist.isAllowed(href)) {
      ev.preventDefault();
      ev.stopPropagation();
      whitelist.recordBlocked('href', href, 'click su <a>');
      blockToast();
      return;
    }

    if (anchor.target === '_blank') {
      ev.preventDefault();
      window.location.href = new URL(href, window.location.href).toString();
    }
  };

  const auxClickHandler = (ev: MouseEvent) => {
    const path = ev.composedPath ? (ev.composedPath() as HTMLElement[]) : [];
    const anchor = path.find((el) => el instanceof HTMLAnchorElement) as
      | HTMLAnchorElement
      | undefined;
    if (!anchor) return;
    const href = anchor.getAttribute('href');
    if (!href || href.startsWith('#')) return;
    ev.preventDefault();
    ev.stopPropagation();
  };

  const submitHandler = (ev: Event) => {
    const form = ev.target as HTMLFormElement | null;
    if (!(form instanceof HTMLFormElement)) return;
    const actionAttr = (form.getAttribute('action') || '').trim();
    if (!actionAttr) return;
    if (!whitelist.isAllowed(actionAttr)) {
      ev.preventDefault();
      ev.stopPropagation();
      whitelist.recordBlocked('action', actionAttr, 'submit form[action]');
      blockToast();
    }
  };

  const hardenLinkLikeElement = (el: Element): void => {
    if (el instanceof HTMLAnchorElement) {
      const href = (el.getAttribute('href') || '').trim();
      if (!href || href.startsWith('#')) return;
      if (!whitelist.isAllowed(href)) {
        el.setAttribute('data-kiosk-blocked-href', href);
        el.removeAttribute('href');
        el.setAttribute('aria-disabled', 'true');
        whitelist.recordBlocked('href', href, 'mutation hardening <a href>');
        return;
      }
      if (el.target === '_blank') {
        el.removeAttribute('target');
      }
      return;
    }
    if (el instanceof HTMLFormElement) {
      const action = (el.getAttribute('action') || '').trim();
      if (!action) return;
      if (!whitelist.isAllowed(action)) {
        el.setAttribute('data-kiosk-blocked-action', action);
        el.removeAttribute('action');
        whitelist.recordBlocked('action', action, 'mutation hardening form[action]');
      }
    }
  };

  const hardenTree = (root: ParentNode): void => {
    root.querySelectorAll('a[href], form[action]').forEach((el) => hardenLinkLikeElement(el));
  };

  document.addEventListener('click', clickHandler, true);
  document.addEventListener('auxclick', auxClickHandler, true);
  document.addEventListener('submit', submitHandler, true);
  hardenTree(document);

  const mutationObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'attributes' && m.target instanceof Element) {
        hardenLinkLikeElement(m.target);
        continue;
      }
      m.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return;
        hardenLinkLikeElement(node);
        hardenTree(node);
      });
    }
  });
  mutationObserver.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['href', 'target', 'action'],
  });

  const kioskAudit = {
    getStats: () => whitelist.getBlockStats(),
    reset: () => whitelist.resetBlockStats(),
  };
  (window as unknown as { kioskSecurityAudit?: typeof kioskAudit }).kioskSecurityAudit =
    kioskAudit;

  try {
    window.open = ((url?: string | URL, _target?: string, _features?: string) => {
      if (!url) return null;
      const href = typeof url === 'string' ? url : url.toString();
      if (!whitelist.isAllowed(href)) {
        whitelist.recordBlocked('open', href, 'window.open');
        blockToast();
        return null;
      }
      window.location.href = new URL(href, window.location.href).toString();
      return null;
    }) as typeof window.open;
  } catch (e) {
    console.warn('🔒 [Kiosk] window.open non patchabile:', e);
  }

  const locationAssignPatched = patchLocationNavMethod(
    'assign',
    originalAssign,
    whitelist,
    blockToast
  );
  const locationReplacePatched = patchLocationNavMethod(
    'replace',
    originalReplace,
    whitelist,
    blockToast
  );

  let originalLocationHrefSet: ((value: string) => void) | null = null;
  let locationHrefPatched = false;
  try {
    const locProto = locationPrototype();
    const desc = Object.getOwnPropertyDescriptor(locProto, 'href');
    if (desc?.set) {
      originalLocationHrefSet = desc.set.bind(window.location);
      const originalSet = originalLocationHrefSet;
      Object.defineProperty(locProto, 'href', {
        configurable: true,
        enumerable: desc.enumerable,
        get: desc.get,
        set(value: string) {
          if (!whitelist.isAllowed(value)) {
            whitelist.recordBlocked('open', value, 'location.href');
            blockToast();
            return;
          }
          originalSet(value);
        },
      });
      locationHrefPatched = true;
    }
  } catch (e) {
    console.warn('🔒 [Kiosk] location.href non patchabile:', e);
  }

  void patchCapacitorBrowserOpen(whitelist, blockToast);
  const originalThemeableBrowserOpen = patchThemeableBrowserStrict();

  state = {
    whitelist,
    notifyBlocked,
    originalOpen,
    originalAssign,
    originalReplace,
    locationAssignPatched,
    locationReplacePatched,
    originalLocationHrefSet,
    locationHrefPatched,
    originalBrowserOpen: null,
    originalThemeableBrowserOpen,
    mutationObserver,
    clickHandler,
    auxClickHandler,
    submitHandler,
  };

  void loadCapacitorBrowserPatchIntoState(state, whitelist, blockToast);
}

export function uninstallKioskOutboundGuard(): void {
  if (!state) return;

  document.removeEventListener('click', state.clickHandler, true);
  document.removeEventListener('auxclick', state.auxClickHandler, true);
  document.removeEventListener('submit', state.submitHandler, true);
  state.mutationObserver?.disconnect();
  delete (window as unknown as { kioskSecurityAudit?: unknown }).kioskSecurityAudit;

  try {
    window.open = state.originalOpen;
  } catch {
    /* noop */
  }

  if (state.locationAssignPatched) {
    restoreLocationNavMethod('assign', state.originalAssign);
  }
  if (state.locationReplacePatched) {
    restoreLocationNavMethod('replace', state.originalReplace);
  }

  if (state.locationHrefPatched && state.originalLocationHrefSet) {
    try {
      const locProto = locationPrototype();
      const desc = Object.getOwnPropertyDescriptor(locProto, 'href');
      if (desc?.get) {
        Object.defineProperty(locProto, 'href', {
          configurable: true,
          enumerable: desc.enumerable,
          get: desc.get,
          set: state.originalLocationHrefSet,
        });
      }
    } catch {
      /* noop */
    }
  }

  restoreCapacitorBrowser(state.originalBrowserOpen);
  restoreThemeableBrowser(state.originalThemeableBrowserOpen);
  state = null;
}

async function patchCapacitorBrowserOpen(
  whitelist: KioskWhitelistService,
  blockToast: () => void
): Promise<((options: { url: string }) => Promise<void>) | null> {
  try {
    const mod = await import('@capacitor/browser');
    const Browser = mod.Browser;
    if (!Browser?.open) return null;
    const originalBrowserOpen = Browser.open.bind(Browser);
    Browser.open = (async (options: { url: string }) => {
      const href = String(options?.url || '');
      if (!href || !whitelist.isAllowed(href)) {
        whitelist.recordBlocked('open', href, 'Capacitor Browser.open');
        blockToast();
        return;
      }
      return originalBrowserOpen(options);
    }) as typeof Browser.open;
    return originalBrowserOpen;
  } catch {
    return null;
  }
}

async function loadCapacitorBrowserPatchIntoState(
  guardState: GuardState,
  whitelist: KioskWhitelistService,
  blockToast: () => void
): Promise<void> {
  guardState.originalBrowserOpen = await patchCapacitorBrowserOpen(whitelist, blockToast);
}

function restoreCapacitorBrowser(
  original: ((options: { url: string }) => Promise<void>) | null
): void {
  if (!original) return;
  void import('@capacitor/browser')
    .then(({ Browser }) => {
      Browser.open = original as typeof Browser.open;
    })
    .catch(() => {});
}

/** In strict mode blocca ThemeableBrowser (Cordova) che apre Chrome/Safari di sistema. */
function patchThemeableBrowserStrict(): ((...args: unknown[]) => unknown) | null {
  if (!environment.kioskStrictMode) return null;
  try {
    const w = window as unknown as {
      cordova?: { ThemeableBrowser?: { open?: (...args: unknown[]) => unknown } };
    };
    const tb = w.cordova?.ThemeableBrowser;
    if (!tb?.open) return null;
    const original = tb.open.bind(tb);
    tb.open = (...args: unknown[]) => {
      const url = String(args[0] ?? '');
      console.warn('🔒 [Kiosk] ThemeableBrowser.open bloccato (strict):', url.slice(0, 120));
      return null;
    };
    return original;
  } catch {
    return null;
  }
}

function restoreThemeableBrowser(original: ((...args: unknown[]) => unknown) | null): void {
  if (!original) return;
  try {
    const w = window as unknown as {
      cordova?: { ThemeableBrowser?: { open?: (...args: unknown[]) => unknown } };
    };
    const tb = w.cordova?.ThemeableBrowser;
    if (tb) tb.open = original;
  } catch {
    /* noop */
  }
}

/** Rimuove link attivi da HTML CMS (scheda attività, ecc.) — il totem non deve aprire siti esterni dal testo. */
export function sanitizeKioskProseHtml(html: string | null | undefined): string {
  const raw = String(html ?? '').trim();
  if (!raw) return '…';
  return raw.replace(
    /<a\b([^>]*?)href\s*=\s*["'][^"']*["']([^>]*)>([\s\S]*?)<\/a>/gi,
    '<span class="kiosk-prose-link-disabled"$1$2>$3</span>'
  );
}
