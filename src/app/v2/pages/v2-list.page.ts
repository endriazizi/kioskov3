import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs/operators';

import { V2CatalogStore } from '../v2-catalog.store';
import { V2BusinessCardComponent } from './v2-business-card.component';

@Component({
  selector: 'app-v2-list',
  standalone: true,
  imports: [RouterLink, V2BusinessCardComponent],
  template: `
    <section class="v2-page">
      <header class="v2-page-head">
        <h1>{{ cat() || 'Tutte le attività' }}</h1>
        <span class="v2-muted">{{ items().length }} risultati</span>
      </header>
      <div class="v2-chips scroll">
        <a class="v2-chip-btn" routerLink="/v2/attivita" [class.on]="!cat()">Tutte</a>
        @for (c of store.categories(); track c) {
          <a class="v2-chip-btn" routerLink="/v2/attivita" [queryParams]="{ cat: c }" [class.on]="c === cat()">{{ c }}</a>
        }
      </div>
      <div class="v2-grid">
        @for (b of items(); track b.slug || b.id) {
          <app-v2-business-card [business]="b" [isNew]="store.isRecentlyAdded(b)" />
        } @empty {
          <p class="v2-empty">{{ store.loaded() ? 'Nessuna attività in questa categoria.' : 'Caricamento…' }}</p>
        }
      </div>
    </section>
  `,
})
export class V2ListPage {
  readonly store = inject(V2CatalogStore);
  private readonly route = inject(ActivatedRoute);

  readonly cat = toSignal(this.route.queryParamMap.pipe(map((q) => (q.get('cat') ?? '').trim())), { initialValue: '' });
  readonly items = computed(() => {
    const c = this.cat();
    const all = this.store.businesses();
    return c ? all.filter((b) => b.category === c) : all;
  });
}
