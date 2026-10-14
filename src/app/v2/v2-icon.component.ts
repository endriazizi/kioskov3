import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, input } from '@angular/core';

import { V2_ICONS, V2IconName } from './v2-icons';

/**
 * Icona SVG da costanti interne. Scritta direttamente nel DOM perché il sanitizer di Angular
 * rimuove gli SVG da `[innerHTML]`; il contenuto non arriva mai da API o da input utente.
 */
@Component({
  selector: 'app-v2-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
  host: { class: 'v2-icon', 'aria-hidden': 'true' },
})
export class V2IconComponent {
  readonly name = input.required<V2IconName>();
  private readonly el = inject(ElementRef<HTMLElement>);

  constructor() {
    effect(() => {
      this.el.nativeElement.innerHTML = V2_ICONS[this.name()];
    });
  }
}
