import { Component, computed, inject } from '@angular/core';

import { V2CatalogStore } from '../v2-catalog.store';
import { V2IconComponent } from '../v2-icon.component';
import { V2UiState } from '../v2-ui.state';
import { V2BusinessCardComponent } from './v2-business-card.component';

function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

@Component({
  selector: 'app-v2-search',
  standalone: true,
  imports: [V2IconComponent, V2BusinessCardComponent],
  template: `
    <section class="v2-page">
      <button type="button" class="v2-search-field" (click)="ui.keyboardOpen.set(true)">
        <app-v2-icon name="search" />
        <span [class.v2-muted]="!ui.query()">{{ ui.query() || 'Scrivi il nome o il tipo di attività' }}</span>
        <span class="v2-caret" aria-hidden="true"></span>
      </button>
      @if (ui.query().trim().length >= 2) {
        <p class="v2-muted">{{ results().length }} risultati per «{{ ui.query().trim() }}»</p>
        <div class="v2-grid">
          @for (b of results(); track b.slug || b.id) {
            <app-v2-business-card [business]="b" />
          } @empty {
            <p class="v2-empty">Nessun risultato. Prova con una parola diversa.</p>
          }
        </div>
      } @else {
        <p class="v2-muted">Digita almeno 2 lettere.</p>
      }
    </section>
  `,
})
export class V2SearchPage {
  readonly store = inject(V2CatalogStore);
  readonly ui = inject(V2UiState);

  readonly results = computed(() => {
    const q = norm(this.ui.query().trim());
    if (q.length < 2) return [];
    const words = q.split(/\s+/).filter(Boolean);
    return this.store.businesses().filter((b) => {
      const hay = norm(`${b.name} ${b.category} ${b.address} ${b.title ?? ''}`);
      return words.every((w) => hay.includes(w));
    });
  });
}
