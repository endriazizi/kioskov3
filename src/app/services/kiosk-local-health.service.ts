import { Injectable, OnDestroy } from '@angular/core';
import { environment } from '../../environments/environment';
import { kioskDevLog, kioskDevWarn } from '../utils/kiosk-dev-console';

/**
 * Totem strict: verifica periodicamente che il dev server locale (ng serve :8200) risponda.
 * Utile quando Chrome resta aperto sulla pagina "errore connessione" dopo crash di ng serve.
 */
@Injectable({ providedIn: 'root' })
export class KioskLocalHealthService implements OnDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private inFlight = false;
  private consecutiveFailures = 0;
  private lastReloadAt = 0;

  start(): void {
    this.stop();
    if (!environment.kioskStrictMode) return;
    const cfg = environment as {
      kioskLocalHealthCheckEnabled?: boolean;
      kioskLocalHealthCheckMs?: number;
      kioskLocalHealthReloadCooldownMs?: number;
    };
    if (cfg.kioskLocalHealthCheckEnabled === false) return;

    const intervalMs = this.resolveIntervalMs(cfg.kioskLocalHealthCheckMs);
    kioskDevLog('🩺 [Totem] Health check localhost ogni', Math.round(intervalMs / 1000), 's');
    void this.pingLocalServer();
    this.timer = setInterval(() => void this.pingLocalServer(), intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    this.inFlight = false;
  }

  ngOnDestroy(): void {
    this.stop();
  }

  private resolveIntervalMs(raw?: number): number {
    if (Number.isFinite(raw) && (raw as number) > 0) {
      return Math.min(600_000, Math.max(30_000, Math.round(raw as number)));
    }
    return 120_000;
  }

  private resolveReloadCooldownMs(): number {
    const raw = Number(
      (environment as { kioskLocalHealthReloadCooldownMs?: number })
        .kioskLocalHealthReloadCooldownMs
    );
    if (Number.isFinite(raw) && raw > 0) {
      return Math.min(600_000, Math.max(60_000, Math.round(raw)));
    }
    return 120_000;
  }

  private async pingLocalServer(): Promise<void> {
    if (this.inFlight) return;
    if (document.visibilityState === 'hidden') return;
    this.inFlight = true;
    const origin = window.location.origin;
    const url = `${origin}/`;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (res.ok || (res.status >= 300 && res.status < 500)) {
        this.consecutiveFailures = 0;
        return;
      }
      this.registerFailure('status');
    } catch {
      this.registerFailure('network');
    } finally {
      this.inFlight = false;
    }
  }

  private registerFailure(kind: 'status' | 'network'): void {
    this.consecutiveFailures += 1;
    kioskDevWarn(
      `⚠️ [Totem] Health localhost KO (${kind}) — fallimenti consecutivi:`,
      this.consecutiveFailures
    );
    if (this.consecutiveFailures < 2) return;
    const now = Date.now();
    const cooldown = this.resolveReloadCooldownMs();
    if (now - this.lastReloadAt < cooldown) {
      kioskDevLog('🧩 [Totem] Reload health saltato (cooldown)');
      return;
    }
    this.lastReloadAt = now;
    this.consecutiveFailures = 0;
    kioskDevLog('🔄 [Totem] localhost non risponde — reload pagina');
    window.location.reload();
  }
}
