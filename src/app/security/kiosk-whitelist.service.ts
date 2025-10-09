import { Injectable, InjectionToken, Inject, Optional } from '@angular/core';

export type WhitelistRule = string | RegExp;

/** Extend ALLOW rules from modules/environments */
export const KIOSK_WHITELIST = new InjectionToken<WhitelistRule[]>('KIOSK_WHITELIST');
/** Extend DENY rules from modules/environments (takes priority) */
export const KIOSK_DENYLIST = new InjectionToken<WhitelistRule[]>('KIOSK_DENYLIST');
/** If true, same-origin URLs are always allowed (default: true) */
export const KIOSK_ALLOW_SAME_ORIGIN = new InjectionToken<boolean>('KIOSK_ALLOW_SAME_ORIGIN');

@Injectable({ providedIn: 'root' })
export class KioskWhitelistService {
  /** Allowed URL schemes (keep tight for kiosk use) */
  private readonly allowedSchemes = new Set(['http:', 'https:', 'tel:', 'mailto:']);

  /** Base allow rules (merge with injected extras) */
  private readonly baseAllow: WhitelistRule[] = [
    // Your sites
    'castelraimondoturismo.it',
    'viverecamerino.it',
    'cronachemaceratesi.it',
    'picchionews.it',
    'comune.castelraimondo.mc.it',

    // Instagram widget providers (runtime)
    'elfsightcdn.com',
    'apps.elfsight.com',
    'cdn.lightwidget.com',

    // Instagram media CDNs
    'cdninstagram.com',
    'fbcdn.net',

    // Examples for path-specific APIs:
    // /https?:\/\/api\.miosito\.it\/v[12]\/.*/,
  ];

  /** Effective (merged) lists */
  private readonly allowRules: WhitelistRule[];
  private readonly denyRules: WhitelistRule[];

  constructor(
    @Optional() @Inject(KIOSK_WHITELIST) extraAllow?: WhitelistRule[],
    @Optional() @Inject(KIOSK_DENYLIST) extraDeny?: WhitelistRule[],
    @Optional() @Inject(KIOSK_ALLOW_SAME_ORIGIN) private allowSameOrigin: boolean = true
  ) {
    this.allowRules = [...this.baseAllow, ...(extraAllow ?? [])];
    this.denyRules = [...(extraDeny ?? [])];
  }

  /**
   * Returns true if the URL is permitted by:
   * 1) scheme check
   * 2) deny rules (first; any hit = blocked)
   * 3) allow rules (string = host/subdomain OR absolute URL prefix; regex = full href test)
   * 4) same-origin bypass (optional)
   */
  isAllowed(rawUrl: string): boolean {
    const url = this.tryParseUrl(rawUrl);
    if (!url) return false;

    // 1) Scheme guard
    if (!this.allowedSchemes.has(url.protocol)) return false;

    // 2) DENY first
    if (this.matchesAny(url, this.denyRules)) return false;

    // 3) ALLOW
    if (this.matchesAny(url, this.allowRules)) return true;

    // 4) Same-origin bypass (optional)
    if (this.allowSameOrigin) {
      const appOrigin = this.safeAppOrigin();
      if (appOrigin && url.origin === appOrigin) return true;
    }

    return false;
  }

  /** Optionally add rules at runtime (e.g., admin UI) */
  addAllowRule(rule: WhitelistRule) { (this.allowRules as WhitelistRule[]).push(rule); }
  addDenyRule(rule: WhitelistRule)  { (this.denyRules  as WhitelistRule[]).push(rule); }

  // ───────────────────────── helpers ─────────────────────────

  private tryParseUrl(raw: string): URL | null {
    try { return new URL(raw, window.location.href); }
    catch { return null; }
  }

  private safeAppOrigin(): string | null {
    try { return new URL(window.location.href).origin; }
    catch { return null; }
  }

  private matchesAny(url: URL, rules: WhitelistRule[]): boolean {
    for (const rule of rules) {
      if (typeof rule === 'string') {
        if (this.stringRuleMatch(url, rule)) return true;
      } else {
        if (rule.test(url.href)) return true;
      }
    }
    return false;
  }

  /**
   * String rules:
   *  - "example.com"  → allow that host and subdomains (host check)
   *  - "https://example.com/path" → allow URL prefix (href startsWith)
   */
  private stringRuleMatch(url: URL, rule: string): boolean {
    const trimmed = rule.trim();

    // Absolute URL prefix rule?
    if (trimmed.includes('://')) {
      // Normalize trailing slash on rule to avoid accidental mismatches
      const prefix = trimmed.endsWith('/') ? trimmed : trimmed;
      return url.href.startsWith(prefix);
    }

    // Host rule (allow domain + subdomains)
    const host = url.hostname.toLowerCase();
    const ruleHost = trimmed.toLowerCase().replace(/^\./, ''); // tolerate ".example.com"
    return host === ruleHost || host.endsWith('.' + ruleHost);
  }
}
