import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';

/**
 * Orologio live isolato (OnPush): evita change detection sull’intera TutorialPage ogni secondo.
 */
@Component({
  standalone: true,
  selector: 'app-kiosk-live-clock',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./kiosk-live-clock.component.scss'],
  template: `
    <div class="kiosk-live-strip__clock" aria-live="polite">
      <div
        class="kiosk-live-strip__time-card"
        role="group"
        aria-labelledby="kiosk-live-time-label"
      >
        <span id="kiosk-live-time-label" class="kiosk-live-strip__time-eyebrow">Ora</span>
        <div class="kiosk-live-strip__time-row">
          <span class="kiosk-live-strip__clock-icon" aria-hidden="true">🕒</span>
          <div class="clock">{{ time() }}</div>
        </div>
      </div>
    </div>
  `,
})
export class KioskLiveClockComponent implements OnInit, OnDestroy {
  readonly time = signal('');

  private tickTimer?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    this.refreshTime();
    this.tickTimer = setInterval(() => this.refreshTime(), 1000);
  }

  ngOnDestroy(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = undefined;
    }
  }

  private refreshTime(): void {
    const now = new Date();
    this.time.set(
      now.toLocaleTimeString('it-IT', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    );
  }
}
