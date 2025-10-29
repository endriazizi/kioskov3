// src/app/shared/kiosk-ui-top.ts
//
// 📏 Calcolo dinamico di --kiosk-ui-top (toolbar + box meteo + gap).
// Scrive :root { --kiosk-ui-top: <px> } e si aggiorna su resize/orientation.
// Non richiede dipendenze; viene richiamato da tutorial.ts.

export function recalcKioskUiTop(opts?: { extraPadding?: number; log?: boolean }) {
  const d = document;
  if (!d?.documentElement) return;

  const header = d.querySelector('.toolbar-logo') as HTMLElement | null;
  const info   = d.querySelector('.info-kiosk')  as HTMLElement | null;

  const gap = 12;                           // spazio tra i due blocchi
  const pad = opts?.extraPadding ?? 8;      // padding di sicurezza

  const h1 = header ? rectWithMargins(header) : 0;
  const h2 = info   ? rectWithMargins(info)   : 0;

  let value = Math.round(h1 + h2 + gap + pad);

  // clamp per evitare misure temporanee “sballate”
  const min = 160;
  const max = Math.round(window.innerHeight * 0.55);
  if (value < min) value = min;
  if (value > max) value = max;

  d.documentElement.style.setProperty('--kiosk-ui-top', `${value}px`);
  if (opts?.log) console.debug('📏 [kiosk-ui-top] set →', value, 'px');

  return value;

  function rectWithMargins(el: HTMLElement) {
    const r  = el.getBoundingClientRect();
    const cs = window.getComputedStyle(el);
    const mt = parseFloat(cs.marginTop || '0') || 0;
    const mb = parseFloat(cs.marginBottom || '0') || 0;
    return r.height + mt + mb;
  }
}

/** Aggancia listener e calcola all’avvio. */
export function bindKioskUiTopAuto() {
  const recalc = () => recalcKioskUiTop({ log: true });

  if (document.readyState !== 'loading') setTimeout(recalc, 0);
  else document.addEventListener('DOMContentLoaded', recalc, { once: true });
  window.addEventListener('load', recalc, { once: true });

  const deb = debounce(recalc, 150);
  window.addEventListener('resize', deb);
  window.addEventListener('orientationchange', deb);

  try {
    const target = document.querySelector('.info-kiosk');
    if (target) {
      const obs = new MutationObserver(debounce(recalc, 100));
      obs.observe(target, { childList: true, subtree: true, characterData: true });
    }
  } catch { /* no-op */ }
}

function debounce<T extends (...a: any[]) => void>(fn: T, ms: number) {
  let t: any;
  return (...args: any[]) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
