import { Injectable, NgZone, OnDestroy, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../environments/environment';
import { KioskApiService } from '../providers/kiosk-api.service';

/**
 * Inattività del totem v2: un solo timer e un solo listener per l'intera app.
 * Il timeout arriva dalle impostazioni admin esistenti (GET /api/public-kiosk/home → idleFullscreen).
 */
@Injectable({ providedIn: 'root' })
export class V2IdleService implements OnDestroy {
  private readonly zone = inject(NgZone);
  private readonly api = inject(KioskApiService);

  /** Incrementato a ogni scadenza: la shell reagisce (torna alla Home, poi schermata di benvenuto). */
  readonly expired = signal(0);
  readonly enabled = signal(true);
  readonly timeoutMs = signal(60_000);

  private started = false;
  private lastInput = Date.now();
  private timer?: ReturnType<typeof setInterval>;
  private readonly bump = () => {
    this.lastInput = Date.now();
  };

  start(): void {
    if (this.started) return;
    this.started = true;
    void this.loadConfig();
    this.zone.runOutsideAngular(() => {
      document.addEventListener('pointerdown', this.bump, { capture: true, passive: true });
      document.addEventListener('keydown', this.bump, { capture: true });
      this.timer = setInterval(() => this.tick(), 1000);
    });
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    clearInterval(this.timer);
    document.removeEventListener('pointerdown', this.bump, { capture: true });
    document.removeEventListener('keydown', this.bump, { capture: true });
  }

  ngOnDestroy(): void {
    this.stop();
  }

  /** Millisecondi trascorsi dall'ultimo tocco (per indicatori UI). */
  idleForMs(): number {
    return Date.now() - this.lastInput;
  }

  reset(): void {
    this.lastInput = Date.now();
  }

  async loadConfig(): Promise<void> {
    if (!environment.useKioskPublicApi) return;
    try {
      const cfg = this.api.unwrapIdleFullscreenConfig(await firstValueFrom(this.api.getHome({ silent: true })));
      this.enabled.set(cfg.enabled);
      this.timeoutMs.set(cfg.timeoutMs);
    } catch {
      /* default 60 s */
    }
  }

  private tick(): void {
    if (!this.enabled()) return;
    if (Date.now() - this.lastInput < this.timeoutMs()) return;
    this.lastInput = Date.now();
    this.zone.run(() => this.expired.update((n) => n + 1));
  }
}
