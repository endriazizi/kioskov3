import { Injectable, signal } from '@angular/core';

/**
 * Contatore richieste HTTP verso `/api/public-kiosk/*` per un unico overlay di caricamento.
 */
@Injectable({ providedIn: 'root' })
export class KioskLoadingService {
  private count = 0;
  private showTimer: ReturnType<typeof setTimeout> | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly SHOW_DELAY_MS = 120;
  private readonly HIDE_DELAY_MS = 120;
  readonly loading = signal(false);

  begin(): void {
    this.count++;
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }

    if (this.loading()) return;
    if (this.showTimer) return;

    this.showTimer = setTimeout(() => {
      this.showTimer = null;
      if (this.count > 0) this.loading.set(true);
    }, this.SHOW_DELAY_MS);
  }

  end(): void {
    this.count = Math.max(0, this.count - 1);
    if (this.count > 0) return;

    if (this.showTimer) {
      clearTimeout(this.showTimer);
      this.showTimer = null;
    }

    if (!this.loading()) return;
    if (this.hideTimer) return;

    this.hideTimer = setTimeout(() => {
      this.hideTimer = null;
      if (this.count === 0) this.loading.set(false);
    }, this.HIDE_DELAY_MS);
  }
}
