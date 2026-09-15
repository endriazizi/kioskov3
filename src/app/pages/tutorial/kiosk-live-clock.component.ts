import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  ViewChild,
  inject,
} from '@angular/core';

/**
 * Orologio live isolato (OnPush): tick e scrittura DOM fuori da Zone.js.
 * Nessun signal / detectChanges: non triggera CD su TutorialPage ogni secondo (flicker GPU).
 */
@Component({
  standalone: true,
  selector: 'app-kiosk-live-clock',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./kiosk-live-clock.component.scss'],
  template: `
    <div class="kiosk-live-strip__clock" aria-live="off">
      <div
        class="kiosk-live-strip__time-card"
        role="group"
        aria-labelledby="kiosk-live-time-label"
      >
        <span id="kiosk-live-time-label" class="kiosk-live-strip__time-eyebrow">Ora</span>
        <div class="kiosk-live-strip__time-row">
          <span class="kiosk-live-strip__clock-icon" aria-hidden="true">🕒</span>
          <div #clockFace class="clock"></div>
        </div>
      </div>
    </div>
  `,
})
export class KioskLiveClockComponent implements AfterViewInit, OnDestroy {
  @ViewChild('clockFace', { static: true })
  private clockFace!: ElementRef<HTMLDivElement>;

  private readonly zone = inject(NgZone);
  private tickTimer?: ReturnType<typeof setInterval>;

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      this.writeTime();
      this.tickTimer = setInterval(() => this.writeTime(), 1000);
    });
  }

  ngOnDestroy(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = undefined;
    }
  }

  private writeTime(): void {
    const el = this.clockFace?.nativeElement;
    if (!el) return;
    el.textContent = new Date().toLocaleTimeString('it-IT', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }
}
