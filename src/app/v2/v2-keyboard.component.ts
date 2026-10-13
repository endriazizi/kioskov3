import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { V2UiState } from './v2-ui.state';

const ROWS = ['1234567890', 'QWERTYUIOP', 'ASDFGHJKL\'', 'ZXCVBNM-'];

/**
 * Tastiera a schermo del totem: scrive solo in `V2UiState.query`, nessuna tastiera di sistema.
 * Non apre mai link o finestre: i tasti sono pulsanti puri.
 */
@Component({
  selector: 'app-v2-keyboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="v2-kb" role="group" aria-label="Tastiera">
      @for (row of rows; track row) {
        <div class="v2-kb-row">
          @for (k of row; track k) {
            <button type="button" class="v2-key" (click)="type(k)">{{ k }}</button>
          }
        </div>
      }
      <div class="v2-kb-row">
        <button type="button" class="v2-key wide" (click)="backspace()">Cancella</button>
        <button type="button" class="v2-key space" (click)="type(' ')">Spazio</button>
        <button type="button" class="v2-key wide" (click)="clear()">Svuota</button>
        <button type="button" class="v2-key wide accent" (click)="ui.keyboardOpen.set(false)">Chiudi</button>
      </div>
    </div>
  `,
})
export class V2KeyboardComponent {
  readonly ui = inject(V2UiState);
  readonly rows = ROWS.map((r) => r.split(''));

  type(k: string): void {
    this.ui.query.update((q) => (q.length >= 40 ? q : (q + k.toLowerCase()).replace(/^\s+/, '').replace(/\s{2,}/g, ' ')));
  }

  backspace(): void {
    this.ui.query.update((q) => q.slice(0, -1));
  }

  clear(): void {
    this.ui.query.set('');
  }
}
