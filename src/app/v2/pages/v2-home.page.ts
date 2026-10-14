import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { V2CatalogStore } from '../v2-catalog.store';
import { V2IconComponent } from '../v2-icon.component';
import type { V2Poster } from '../v2-poster.util';
import { V2UiState } from '../v2-ui.state';
import { V2BusinessCardComponent } from './v2-business-card.component';
import { v2DayLabel } from './v2-date.util';

const POSTER_MS = 8000;

@Component({
  selector: 'app-v2-home',
  standalone: true,
  imports: [V2IconComponent, RouterLink, V2BusinessCardComponent],
  template: `
    @if (ui.design() === 'A') {
      <section class="v2-home-a">
        <div class="v2-stage">
          @if (current(); as p) {
            <button type="button" class="v2-poster" (click)="openPoster(p)" [attr.aria-label]="p.businessName || p.title || 'Poster'">
              @if (p.kind === 'video') {
                <video [src]="p.src" autoplay muted playsinline (ended)="next()" (error)="next()"></video>
              } @else {
                <img [src]="p.src" alt="" (error)="onImgError($event, p)" />
              }
              @if (p.businessName || p.title) {
                <span class="v2-poster-cap">
                  <strong>{{ p.businessName || p.title }}</strong>
                  @if (p.subtitle) { <span>{{ p.subtitle }}</span> }
                </span>
              }
            </button>
            @if (store.posters().length > 1) {
              <div class="v2-dots" aria-hidden="true">
                @for (x of store.posters(); track x.key; let i = $index) {
                  <i [class.on]="i === index()"></i>
                }
              </div>
            }
          } @else {
            <div class="v2-welcome">
              <h1>Benvenuti a Castelraimondo</h1>
              <p>Scopri attività, eventi e servizi del territorio.</p>
            </div>
          }
        </div>
        <aside class="v2-side">
          <h2>Prossimi eventi</h2>
          @for (e of nextEvents(); track e.id) {
            <a class="v2-event-row" routerLink="/v2/eventi">
              <span class="v2-date"><b>{{ day(e.dateIso).day }}</b>{{ day(e.dateIso).month }}</span>
              <span><strong>{{ e.title }}</strong><small>{{ e.timeLabel }}{{ e.timeLabel && e.location ? ' · ' : '' }}{{ e.location }}</small></span>
            </a>
          } @empty {
            <p class="v2-muted">Nessun evento in programma.</p>
          }
          <h2>Esplora</h2>
          <div class="v2-chips">
            @for (c of store.categories(); track c) {
              <a class="v2-chip-btn" routerLink="/v2/attivita" [queryParams]="{ cat: c }">{{ c }}</a>
            }
          </div>
        </aside>
      </section>
    } @else {
      <section class="v2-home-b">
        <h1>Cosa stai cercando?</h1>
        <a class="v2-search-cta" routerLink="/v2/cerca"><app-v2-icon name="search" />Cerca un'attività, un servizio, un evento</a>
        <div class="v2-cat-grid">
          @for (c of store.categories(); track c) {
            <a class="v2-cat" routerLink="/v2/attivita" [queryParams]="{ cat: c }">
              <strong>{{ c }}</strong><small>{{ countFor(c) }} attività</small>
            </a>
          }
        </div>
        @if (store.featured().length) {
          <h2>In evidenza</h2>
          <div class="v2-grid">
            @for (b of store.featured().slice(0, 8); track b.slug || b.id) {
              <app-v2-business-card [business]="b" [isNew]="store.isRecentlyAdded(b)" />
            }
          </div>
        }
      </section>
    }
    @if (!store.loaded()) {
      <div class="v2-loading">Caricamento…</div>
    }
  `,
})
export class V2HomePage implements OnInit, OnDestroy {
  readonly store = inject(V2CatalogStore);
  readonly ui = inject(V2UiState);
  private readonly router = inject(Router);
  readonly day = v2DayLabel;

  readonly index = signal(0);
  readonly current = computed<V2Poster | null>(() => {
    const list = this.store.posters();
    return list.length ? list[this.index() % list.length] : null;
  });
  readonly nextEvents = computed(() => this.store.events().slice(0, 4));
  private readonly counts = computed(() => {
    const m = new Map<string, number>();
    for (const b of this.store.businesses()) m.set(b.category, (m.get(b.category) ?? 0) + 1);
    return m;
  });
  private timer?: ReturnType<typeof setInterval>;

  constructor() {
    // Se la lista poster si accorcia (poster revocato), l'indice resta valido.
    effect(() => {
      const n = this.store.posters().length;
      if (n && this.index() >= n) this.index.set(0);
    });
  }

  ngOnInit(): void {
    this.timer = setInterval(() => {
      if (this.current()?.kind !== 'video') this.next();
    }, POSTER_MS);
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }

  next(): void {
    const n = this.store.posters().length;
    if (n) this.index.update((i) => (i + 1) % n);
  }

  countFor(cat: string): number {
    return this.counts().get(cat) ?? 0;
  }

  openPoster(p: V2Poster): void {
    if (p.slug) void this.router.navigate(['/v2/attivita', p.slug]);
  }

  onImgError(ev: Event, p: V2Poster): void {
    const img = ev.target as HTMLImageElement;
    if (p.fallbackSrc && img.src !== p.fallbackSrc) img.src = p.fallbackSrc;
    else this.next();
  }
}
