import { Directive, OnDestroy, OnInit, inject } from '@angular/core';
import { ToastController } from '@ionic/angular';

import { KioskWhitelistService } from './kiosk-whitelist.service';

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
  private mutationObserver: MutationObserver | null = null;

  private clickHandler = (ev: MouseEvent) => {
    // intercetta solo click primario
    if (ev.defaultPrevented || ev.button !== 0) return;
    // #region agent log
    fetch('http://127.0.0.1:7727/ingest/c4e926a9-a777-4a16-97cd-643defec2cb0',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'378a0a'},body:JSON.stringify({sessionId:'378a0a',runId:'pre-fix',hypothesisId:'H3',location:'kiosk-whitelist.directive.ts:clickHandler:start',message:'Whitelist click handler invoked',data:{targetTag:(ev.target as HTMLElement | null)?.tagName ?? null,defaultPrevented:ev.defaultPrevented,button:ev.button},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
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
      // #region agent log
      fetch('http://127.0.0.1:7727/ingest/c4e926a9-a777-4a16-97cd-643defec2cb0',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'378a0a'},body:JSON.stringify({sessionId:'378a0a',runId:'pre-fix',hypothesisId:'H3',location:'kiosk-whitelist.directive.ts:clickHandler:blocked',message:'Whitelist blocked href',data:{href,target:anchor.tagName},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      ev.preventDefault();
      ev.stopPropagation();
      this.whitelist.recordBlocked('href', href, 'click su <a>');
      this.blockToast();
      return;
    }

    // Se target _blank, impedisci nuova finestra: rimani nell'app
    if (anchor.target === '_blank') {
      ev.preventDefault();
      window.location.href = new URL(href, window.location.href).toString();
    }
  };

  private auxClickHandler = (ev: MouseEvent) => {
    // Blocca middle-click / click secondari che possono aprire nuova tab
    const path = ev.composedPath ? (ev.composedPath() as HTMLElement[]) : [];
    const anchor = path.find((el) => el instanceof HTMLAnchorElement) as HTMLAnchorElement | undefined;
    if (!anchor) return;
    const href = anchor.getAttribute('href');
    if (!href || href.startsWith('#')) return;
    ev.preventDefault();
    ev.stopPropagation();
  };

  private submitHandler = (ev: Event) => {
    const form = ev.target as HTMLFormElement | null;
    if (!(form instanceof HTMLFormElement)) return;
    const actionAttr = (form.getAttribute('action') || '').trim();
    // action vuota => submit interno alla pagina corrente
    if (!actionAttr) return;
    if (!this.whitelist.isAllowed(actionAttr)) {
      ev.preventDefault();
      ev.stopPropagation();
      this.whitelist.recordBlocked('action', actionAttr, 'submit form[action]');
      this.blockToast();
    }
  };

  private hardenLinkLikeElement(el: Element): void {
    if (el instanceof HTMLAnchorElement) {
      const href = (el.getAttribute('href') || '').trim();
      if (!href || href.startsWith('#')) return;
      if (!this.whitelist.isAllowed(href)) {
        el.setAttribute('data-kiosk-blocked-href', href);
        el.removeAttribute('href');
        el.setAttribute('aria-disabled', 'true');
        this.whitelist.recordBlocked('href', href, 'mutation hardening <a href>');
        return;
      }
      if (el.target === '_blank') {
        el.removeAttribute('target');
      }
      return;
    }
    if (el instanceof HTMLFormElement) {
      const action = (el.getAttribute('action') || '').trim();
      if (!action) return;
      if (!this.whitelist.isAllowed(action)) {
        el.setAttribute('data-kiosk-blocked-action', action);
        el.removeAttribute('action');
        this.whitelist.recordBlocked('action', action, 'mutation hardening form[action]');
      }
    }
  }

  private hardenTree(root: ParentNode): void {
    root.querySelectorAll('a[href], form[action]').forEach((el) => this.hardenLinkLikeElement(el));
  }

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
    document.addEventListener('auxclick', this.auxClickHandler, true);
    document.addEventListener('submit', this.submitHandler, true);
    this.hardenTree(document);

    this.mutationObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'attributes' && m.target instanceof Element) {
          this.hardenLinkLikeElement(m.target);
          continue;
        }
        m.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          this.hardenLinkLikeElement(node);
          this.hardenTree(node);
        });
      }
    });
    this.mutationObserver.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['href', 'target', 'action'],
    });

    const kioskAudit = {
      getStats: () => this.whitelist.getBlockStats(),
      reset: () => this.whitelist.resetBlockStats(),
    };
    (window as any).kioskSecurityAudit = kioskAudit;

    // 2) Blocca window.open su URL non whitelisted
    window.open = ((url?: string | URL, target?: string, features?: string) => {
      if (!url) return null;
      const href = typeof url === 'string' ? url : url.toString();
      if (!this.whitelist.isAllowed(href)) {
        this.whitelist.recordBlocked('open', href, 'window.open');
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
        this.whitelist.recordBlocked('open', href, 'location.assign');
        this.blockToast();
        return;
      }
      this.originalAssign(href);
    }) as any;

    window.location.replace = ((url: string | URL) => {
      const href = typeof url === 'string' ? url : url.toString();
      if (!this.whitelist.isAllowed(href)) {
        this.whitelist.recordBlocked('open', href, 'location.replace');
        this.blockToast();
        return;
      }
      this.originalReplace(href);
    }) as any;
  }

  ngOnDestroy() {
    document.removeEventListener('click', this.clickHandler, true);
    document.removeEventListener('auxclick', this.auxClickHandler, true);
    document.removeEventListener('submit', this.submitHandler, true);
    this.mutationObserver?.disconnect();
    this.mutationObserver = null;
    delete (window as any).kioskSecurityAudit;
    // ripristina API native
    window.open = this.originalOpen;
    window.location.assign = this.originalAssign as any;
    window.location.replace = this.originalReplace as any;
  }
}
