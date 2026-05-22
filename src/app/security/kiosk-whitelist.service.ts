import { Injectable, InjectionToken, Inject, Optional } from '@angular/core';

import { environment } from '../../environments/environment';

export type WhitelistRule = string | RegExp;
export type KioskBlockType = 'href' | 'action' | 'open';

export interface KioskBlockStats {
  href: number;
  action: number;
  open: number;
  total: number;
  lastBlockedAt: number | null;
}

/** Extend ALLOW rules from modules/environments */
export const KIOSK_WHITELIST = new InjectionToken<WhitelistRule[]>('KIOSK_WHITELIST');
/** Extend DENY rules from modules/environments (takes priority) */
export const KIOSK_DENYLIST = new InjectionToken<WhitelistRule[]>('KIOSK_DENYLIST');
/** If true, same-origin URLs are always allowed (default: true) */
export const KIOSK_ALLOW_SAME_ORIGIN = new InjectionToken<boolean>('KIOSK_ALLOW_SAME_ORIGIN');

@Injectable({ providedIn: 'root' })
export class KioskWhitelistService {
  private readonly blockStatsStorageKey = 'kiosk.security.block-stats.v1';
  /** Allowed URL schemes (keep tight for kiosk use) */
  private readonly allowedSchemes = new Set(['http:', 'https:']);
  /** Schemi che aprono app esterne (telefono, email, messaggistica) */
  private readonly externalAppSchemes = new Set([
    'tel:',
    'mailto:',
    'sms:',
    'whatsapp:',
    'intent:',
  ]);
  private blockStats: KioskBlockStats;

  /** Base allow rules (merge with injected extras) — usati solo se kioskStrictMode=false */
  private readonly baseAllow: WhitelistRule[] = [
    // Your sites
    'castelraimondoturismo.it',
    'viverecamerino.it',
    'cronachemaceratesi.it',
    'pizzerialalanterna.it',
    'prenota.pizzerialalanterna.it',
    'pizzerialalanterna.it',
    'picchionews.it',
    'comune.castelraimondo.mc.it',
    'cosmariambiente.it',
    'infioratadicastelraimondo.it',

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
    this.blockStats = this.loadBlockStats();
  }

  /** True se la policy “solo interno” è attiva (blocca tutti gli http/https esterni). */
  isStrictInternalOnly(): boolean {
    return !!environment.kioskStrictMode;
  }

  /**
   * Returns true if the URL is permitted by:
   * 1) scheme check
   * 2) deny rules (first; any hit = blocked)
   * 3) allow rules (string = host/subdomain OR absolute URL prefix; regex = full href test)
   * 4) same-origin bypass (optional)
   *
   * In **kioskStrictMode** (environment): solo stesso origin, tel/mail (se consentiti), niente altri http/https.
   */
  isAllowed(rawUrl: string): boolean {
    const url = this.tryParseUrl(rawUrl);
    if (!url) return false;

    // 1) tel/mailto/sms/whatsapp: bloccati di default sul totem (evita uscita verso app di sistema)
    if (this.externalAppSchemes.has(url.protocol)) {
      return environment.kioskAllowTelMailto === true;
    }

    // 2) Solo http/https oltre questo punto
    if (!this.allowedSchemes.has(url.protocol)) return false;

    // 3) DENY first
    if (this.matchesAny(url, this.denyRules)) return false;

    // ─── Policy centralizzata “internal-only” (totem kiosk) ───
    if (environment.kioskStrictMode) {
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        const appOrigin = this.safeAppOrigin();
        return !!appOrigin && url.origin === appOrigin;
      }
      return false;
    }

    // 3) ALLOW (legacy whitelist domini quando non in strict mode)
    if (this.matchesAny(url, this.allowRules)) return true;

    // 4) Same-origin bypass (optional)
    if (this.allowSameOrigin) {
      const appOrigin = this.safeAppOrigin();
      if (appOrigin && url.origin === appOrigin) return true;
    }

    return false;
  }

  /**
   * Usato da Browser.open / window.open / handler: se false, logga in console e non navigare.
   */
  logBlockedExternal(rawUrl: string, reason: string): void {
    console.warn(
      `🔒 [Kiosk] Uscita verso URL esterno bloccata (${reason}):`,
      rawUrl
    );
  }

  recordBlocked(type: KioskBlockType, rawUrl: string, reason: string): void {
    this.blockStats[type] += 1;
    this.blockStats.total += 1;
    this.blockStats.lastBlockedAt = Date.now();
    this.persistBlockStats();
    this.logBlockedExternal(rawUrl, reason);
    // #region agent log
    fetch('http://127.0.0.1:7727/ingest/c4e926a9-a777-4a16-97cd-643defec2cb0',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6753ff'},body:JSON.stringify({sessionId:'6753ff',runId:'audit-fix',hypothesisId:'H-block',location:'kiosk-whitelist.service.ts:recordBlocked',message:'Navigazione kiosk bloccata',data:{type,reason,urlPrefix:String(rawUrl||'').slice(0,80)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  }

  getBlockStats(): KioskBlockStats {
    return { ...this.blockStats };
  }

  resetBlockStats(): void {
    this.blockStats = this.emptyBlockStats();
    this.persistBlockStats();
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

  private emptyBlockStats(): KioskBlockStats {
    return { href: 0, action: 0, open: 0, total: 0, lastBlockedAt: null };
  }

  private loadBlockStats(): KioskBlockStats {
    try {
      const raw = window.localStorage.getItem(this.blockStatsStorageKey);
      if (!raw) return this.emptyBlockStats();
      const parsed = JSON.parse(raw) as Partial<KioskBlockStats>;
      return {
        href: Number(parsed.href) || 0,
        action: Number(parsed.action) || 0,
        open: Number(parsed.open) || 0,
        total: Number(parsed.total) || 0,
        lastBlockedAt:
          typeof parsed.lastBlockedAt === 'number' ? parsed.lastBlockedAt : null,
      };
    } catch {
      return this.emptyBlockStats();
    }
  }

  private persistBlockStats(): void {
    try {
      window.localStorage.setItem(this.blockStatsStorageKey, JSON.stringify(this.blockStats));
    } catch {
      // best effort: localStorage potrebbe non essere disponibile
    }
  }
}
