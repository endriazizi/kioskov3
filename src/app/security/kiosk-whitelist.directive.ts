import { Directive, EffectRef, OnDestroy, OnInit, inject } from '@angular/core';
import { KioskWhitelistService } from './kiosk-whitelist.service';
import { ToastController } from '@ionic/angular';

@Directive({
  selector: '[appKioskWhitelist]',
  standalone: true,
})
export class KioskWhitelistDirective implements OnInit, OnDestroy {
  private readonly whitelist = inject(KioskWhitelistService);
  private readonly toast = inject(ToastController);

  private originalOpen = window.open;
  private originalAssign = window.location.assign.bind(window.location);
  private originalReplace = window.location.replace.bind(window.location);

  private clickHandler = (ev: MouseEvent) => {
    // intercetta solo click primario
    if (ev.defaultPrevented || ev.button !== 0) return;
    // trova l'anchor più vicino
    const path = ev.composedPath ? ev.composedPath() as HTMLElement[] : [];
    let anchor: HTMLAnchorElement | null = null;

    for (const el of path as any) {
      if (el && (el as HTMLElement).tagName === 'A') {
        anchor = el as HTMLAnchorElement;
        break;
      }
    }
    if (!anchor) {
      // fallback: risale il DOM
      let node = ev.target as HTMLElement | null;
      while (node && node !== document.body) {
        if (node instanceof HTMLAnchorElement) { anchor = node; break; }
        node = node.parentElement;
      }
    }
    if (!anchor) return;

    const href = anchor.getAttribute('href');
    if (!href || href.startsWith('#')) return; // ancora interna: ok

    const allowed = this.whitelist.isAllowed(href);
    if (!allowed) {
      ev.preventDefault();
      ev.stopPropagation();
      this.blockToast();
      return;
    }

    // Se target _blank, impedisci nuova finestra: rimani nell'app
    if (anchor.target === '_blank') {
      ev.preventDefault();
      window.location.href = new URL(href, window.location.href).toString();
    }
  };

  private async blockToast() {
    const t = await this.toast.create({
      message: 'Link non consentito in modalità kiosk.',
      duration: 2000,
      position: 'bottom',
    });
    t.present();
  }

  ngOnInit() {
    // 1) Intercetta click su link
    document.addEventListener('click', this.clickHandler, true);

    // 2) Blocca window.open su URL non whitelisted
    window.open = ((url?: string | URL, target?: string, features?: string) => {
      if (!url) return null;
      const href = typeof url === 'string' ? url : url.toString();
      if (!this.whitelist.isAllowed(href)) {
        this.blockToast();
        return null;
      }
      // Evita aprire nuove finestre: rimani nella webview
      window.location.href = new URL(href, window.location.href).toString();
      return null;
    }) as any;

    // 3) Best-effort: blocca assign/replace verso URL non whitelisted
    window.location.assign = ((url: string | URL) => {
      const href = typeof url === 'string' ? url : url.toString();
      if (!this.whitelist.isAllowed(href)) {
        this.blockToast();
        return;
      }
      this.originalAssign(href);
    }) as any;

    window.location.replace = ((url: string | URL) => {
      const href = typeof url === 'string' ? url : url.toString();
      if (!this.whitelist.isAllowed(href)) {
        this.blockToast();
        return;
      }
      this.originalReplace(href);
    }) as any;
  }

  ngOnDestroy() {
    document.removeEventListener('click', this.clickHandler, true);
    // ripristina API native
    window.open = this.originalOpen;
    window.location.assign = this.originalAssign as any;
    window.location.replace = this.originalReplace as any;
  }
}
