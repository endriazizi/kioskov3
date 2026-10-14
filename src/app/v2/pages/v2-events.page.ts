import { Component, inject } from '@angular/core';

import { V2CatalogStore } from '../v2-catalog.store';
import { v2DayLabel } from './v2-date.util';

@Component({
  selector: 'app-v2-events',
  standalone: true,
  template: `
    <section class="v2-page">
      <header class="v2-page-head"><h1>Eventi</h1><span class="v2-muted">{{ store.events().length }} in programma</span></header>
      <div class="v2-events">
        @for (e of store.events(); track e.id) {
          <article class="v2-event">
            @if (e.posterUrl) {
              <img [src]="e.posterUrl" alt="" loading="lazy" (error)="$any($event.target).hidden = true" />
            }
            <div class="v2-event-body">
              <span class="v2-date big"><small>{{ day(e.dateIso).dow }}</small><b>{{ day(e.dateIso).day }}</b>{{ day(e.dateIso).month }}</span>
              <div>
                <h2>{{ e.title }}</h2>
                <p class="v2-muted">
                  {{ e.timeLabel }}{{ e.timeLabel && e.location ? ' · ' : '' }}{{ e.location }}
                  @if (e.dateEndIso && e.dateEndIso !== e.dateIso) { · fino al {{ day(e.dateEndIso).day }} {{ day(e.dateEndIso).month }} }
                </p>
                @if (e.description) { <p class="v2-clamp">{{ e.description }}</p> }
              </div>
            </div>
          </article>
        } @empty {
          <p class="v2-empty">{{ store.loaded() ? 'Nessun evento in programma.' : 'Caricamento…' }}</p>
        }
      </div>
    </section>
  `,
})
export class V2EventsPage {
  readonly store = inject(V2CatalogStore);
  readonly day = v2DayLabel;
}
