import { Injectable, NgZone, OnDestroy, inject } from '@angular/core';
import { Router } from '@angular/router';
import { fromEvent, merge, Subscription, timer } from 'rxjs';
import { switchMap, startWith } from 'rxjs/operators';

export interface InactivityOptions {
  timeoutMs?: number;           // default 20000 (20s)
  targetUrl?: string;           // default '/tutorial'
  ignoreIfAlreadyOnTarget?: boolean; // default true
}

@Injectable({ providedIn: 'root' })
export class InactivityService implements OnDestroy {
  private router = inject(Router);
  private zone = inject(NgZone);

  private sub?: Subscription;
  private _timeoutMs = 20000;
  private _targetUrl = '/tutorial';
  private _ignoreIfAlreadyOnTarget = true;

  /** Avvia il watcher di inattività */
  start(options: InactivityOptions = {}) {
    this.stop();
    this._timeoutMs = options.timeoutMs ?? 20000;
    this._targetUrl = options.targetUrl ?? '/tutorial';
    this._ignoreIfAlreadyOnTarget = options.ignoreIfAlreadyOnTarget ?? true;

    // SOLO eventi di input utente (niente scroll), così il carosello non resetta
    const userEvents$ = merge(
      fromEvent(document, 'pointerdown', { passive: true }),
      fromEvent(document, 'pointermove', { passive: true }),
      fromEvent(document, 'keydown', { passive: true }),
      fromEvent(document, 'touchstart', { passive: true }),
      fromEvent(document, 'touchmove', { passive: true }),
      fromEvent(document, 'visibilitychange', { passive: true }) // rientro scheda
    );

    this.sub = userEvents$
      .pipe(
        startWith(0),                           // parte subito
        switchMap(() => timer(this._timeoutMs)) // resetta ogni input
      )
      .subscribe(() => {
        this.zone.run(() => {
          if (this._ignoreIfAlreadyOnTarget && this.onTarget()) return;
          // Usa Router per non ricaricare l’app (evita window.location.href)
          this.router.navigateByUrl(this._targetUrl, { replaceUrl: true })
            .catch(() => {/* ignore */});
        });
      });
  }

  /** Ferma il watcher di inattività */
  stop() {
    this.sub?.unsubscribe();
    this.sub = undefined;
  }

  /** Reset manuale del timer (es. su eventi custom) */
  bump() {
    // basta emettere un evento sintetico
    document.dispatchEvent(new PointerEvent('pointerdown'));
  }

  private onTarget(): boolean {
    // Normalizza path (ignora query/hash)
    const urlTree = this.router.parseUrl(this.router.url);
    const current = '/' + (urlTree.root.children['primary']?.segments.map(s => s.path).join('/') ?? '');
    return current === this._targetUrl;
  }

  ngOnDestroy() { this.stop(); }
}
