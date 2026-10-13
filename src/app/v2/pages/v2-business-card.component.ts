import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { Speaker } from '../../interfaces/conference.interfaces';

/** Card attività riutilizzata da Home, elenco e ricerca. Porta sempre alla scheda interna. */
@Component({
  selector: 'app-v2-business-card',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="v2-card" [routerLink]="['/v2/attivita', key()]">
      <span class="v2-card-media">
        @if (image(); as src) {
          <img [src]="src" alt="" loading="lazy" decoding="async" (error)="broken = true" [hidden]="broken" />
        }
        <span class="v2-mono" aria-hidden="true">{{ initials() }}</span>
      </span>
      <span class="v2-card-body">
        <span class="v2-card-cat">{{ business().category || 'Attività' }}</span>
        <span class="v2-card-title">{{ business().name }}</span>
        @if (business().address) {
          <span class="v2-card-sub">{{ business().address }}</span>
        }
      </span>
      @if (isNew()) {
        <span class="v2-badge">Nuovo</span>
      }
    </a>
  `,
})
export class V2BusinessCardComponent {
  readonly business = input.required<Speaker>();
  readonly isNew = input(false);
  broken = false;

  readonly key = computed(() => this.business().slug || this.business().id);
  readonly image = computed(() => {
    const b = this.business();
    // Niente segnaposto generico: senza cover o logo si vedono le iniziali.
    return b.coverUrl || b.logo || '';
  });
  readonly initials = computed(() =>
    this.business()
      .name.split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join(''),
  );
}
