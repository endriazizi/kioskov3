import { Injectable, signal } from '@angular/core';

export type V2Design = 'A' | 'B';

const DESIGN_KEY = 'kiosk.v2.design';

function readDesign(): V2Design {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('design');
    if (fromUrl === 'A' || fromUrl === 'B') {
      localStorage.setItem(DESIGN_KEY, fromUrl);
      return fromUrl;
    }
    const saved = localStorage.getItem(DESIGN_KEY);
    if (saved === 'A' || saved === 'B') return saved;
  } catch {
    /* storage non disponibile */
  }
  return 'A';
}

/**
 * Stato UI della sessione pubblica: tutto ciò che va azzerato al ritorno per inattività.
 * Il design (A/B) si sceglie per dispositivo con `?design=A|B` nell'URL di avvio di Chrome.
 */
@Injectable({ providedIn: 'root' })
export class V2UiState {
  readonly design = signal<V2Design>(readDesign());
  readonly query = signal('');
  readonly keyboardOpen = signal(false);
  readonly toast = signal<string | null>(null);
  private toastTimer?: ReturnType<typeof setTimeout>;

  showToast(text: string, ms = 4500): void {
    this.toast.set(text);
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), ms);
  }

  /** Cancella i dati temporanei del visitatore. */
  resetSession(): void {
    this.query.set('');
    this.keyboardOpen.set(false);
    this.toast.set(null);
  }
}
