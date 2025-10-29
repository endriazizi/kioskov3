// src/app/shared/kiosk-ui-top.ts
//
// Utility "senza sorprese": misura gli ingombri UI (top + footer) e imposta
// le CSS vars globali usate dalle slide (in particolare --ads-area-h).
// Mantiene compatibilità con la vecchia measureKioskUiTop().
//
// 🔧 Come lavora:
// - top = distanza del contenitore slide (.slide-container) dal top viewport
// - bottom = altezza effettiva del footer sponsor (.pbc-footer .pbc-wrap)
// - gap = piccolo respiro tra poster e footer (default 8px)
// - --ads-area-h = innerHeight - top - bottom - gap
//
// Include un binder al resize per ricalcolare se cambia finestra/zoom.

export type KioskUiOpts = {
  slideSelector?: string;    // contenitore delle slide (default ".slide-container")
  footerSelector?: string;   // contenitore footer sponsor (default ".pbc-footer .pbc-wrap")
  gap?: number;              // spazio di respiro tra poster e footer
};

function qSel<T extends Element = HTMLElement>(sel: string): T | null {
  return document.querySelector(sel) as T | null;
}

export function measureKioskUiSizes(opts: KioskUiOpts = {}) {
  const slideSel = opts.slideSelector ?? '.slide-container';
  const footerSel = opts.footerSelector ?? '.pbc-footer .pbc-wrap';
  const gap = Math.max(0, Math.round(opts.gap ?? 8));

  const slide = qSel<HTMLElement>(slideSel);
  // prova prima il wrapper dei loghi, altrimenti l’intero footer
  let footer = qSel<HTMLElement>(footerSel) || qSel<HTMLElement>('.pbc-footer');

  const vh = window.innerHeight; // ok anche su desktop totem
  let top = 0;
  if (slide) {
    const r = slide.getBoundingClientRect();
    top = Math.max(0, Math.round(r.top));
  }

  let bottom = 0;
  if (footer) {
    const fr = footer.getBoundingClientRect();
    bottom = Math.max(0, Math.round(fr.height));
  } else {
    // fallback "conservativo" se il footer non è presente
    bottom = 72; // default ragionevole per il tuo footer card
  }

  // altezza disponibile per le slide/poster
  const area = Math.max(120, vh - top - bottom - gap);

  const root = document.documentElement;
  root.style.setProperty('--kiosk-ui-top', `${top}px`);
  root.style.setProperty('--kiosk-ui-bottom', `${bottom}px`);
  root.style.setProperty('--ads-gap', `${gap}px`);
  root.style.setProperty('--ads-area-h', `${area}px`);

  // debug comodo
  // console.debug('[kiosk-ui] top=', top, 'bottom=', bottom, 'gap=', gap, 'area=', area);
}

// Compat con versioni precedenti: chi la chiama non si rompe 🙂
export function measureKioskUiTop() {
  measureKioskUiSizes();
}

// Binder semplice a resize/orientation; ritorna l’unbinder.
export function bindKioskUiResize(opts: KioskUiOpts = {}) {
  const onResize = () => measureKioskUiSizes(opts);
  window.addEventListener('resize', onResize, { passive: true });
  // piccolo ricalcolo async (dopo primo paint) — utile su display verticali
  setTimeout(onResize, 0);
  setTimeout(onResize, 250);
  return () => window.removeEventListener('resize', onResize);
}
