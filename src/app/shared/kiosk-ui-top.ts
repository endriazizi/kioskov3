// src/app/shared/kiosk-ui-top.ts
//
// Utility: calcola l’altezza “top” reale (header + box meteo/info) e
// la espone in una CSS var (default: --kiosk-ui-top) su :root.
// Aggiorna automaticamente su resize/orientamento/mutazioni DOM.
//
// Stile: commenti lunghi, log opzionali (debug), unbind pulito.
//
// Uso (come nel tuo tutorial.ts):
// this.unbindKiosk = bindKioskUiTopAuto({
//   headerSelector: 'ion-header',
//   weatherBoxSelector: '.info-kiosk',
//   cssVarName: '--kiosk-ui-top',
//   log: false,
// });
//

export interface KioskAutoOpts {
  /** CSS selector dell’header Ionic (es. 'ion-header') */
  headerSelector?: string;
  /** CSS selector del box info/meteo (es. '.info-kiosk') */
  weatherBoxSelector?: string;
  /** Nome della variabile CSS da aggiornare su :root */
  cssVarName?: string;
  /** Abilita log di diagnostica su console */
  log?: boolean;
  /** Nodo su cui impostare la CSS var (default: document.documentElement) */
  root?: HTMLElement;
}

type Unbind = () => void;

/**
 * Lega misurazioni automatiche e aggiorna :root con la var CSS.
 * Ritorna una funzione di unbind per sganciare gli observer/listener.
 */
export function bindKioskUiTopAuto(opts: KioskAutoOpts = {}): Unbind {
  const {
    headerSelector = 'ion-header',
    weatherBoxSelector = '.info-kiosk',
    cssVarName = '--kiosk-ui-top',
    log = false,
    root = document.documentElement,
  } = opts;

  const debug = (...args: any[]) => {
    if (log) console.debug('[kiosk-ui-top]', ...args);
  };

  let headerEl: HTMLElement | null = null;
  let weatherEl: HTMLElement | null = null;

  // scheduler su rAF per coalescere gli aggiornamenti
  let rafId: number | null = null;
  const schedule = () => {
    if (rafId != null) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(measureAndApply);
  };

  // Misura le altezze reali e aggiorna la CSS var
  function measureAndApply() {
    rafId = null;

    // Resolve lazy (se i nodi non esistevano ancora)
    if (!headerEl) headerEl = document.querySelector<HTMLElement>(headerSelector);
    if (!weatherEl) weatherEl = document.querySelector<HTMLElement>(weatherBoxSelector);

    // Altezza “visiva” con getBoundingClientRect per includere scaling/zoom
    const h = headerEl ? headerEl.getBoundingClientRect().height : 0;
    const w = weatherEl ? weatherEl.getBoundingClientRect().height : 0;

    // Somma “top” totale
    const top = Math.max(0, Math.round(h + w));

    root.style.setProperty(cssVarName, `${top}px`);
    debug(`set ${cssVarName} → ${top}px`, { h, w, headerEl, weatherEl });
  }

  // ───────────────────────── Observer/Listeners ─────────────────────────

  // ResizeObserver (se supportato)
  const ResizeObs: typeof ResizeObserver | undefined = (window as any).ResizeObserver;
  const resizeObs = ResizeObs
    ? new ResizeObs(() => schedule())
    : null;

  // MutationObserver su body per catturare mostramenti/nascondimenti dinamici
  const mutationObs = new MutationObserver(() => schedule());

  // Tentativi periodici di “agganciare” i nodi se arrivano dopo
  const lookupInterval = window.setInterval(() => {
    let attached = false;
    if (!headerEl) {
      headerEl = document.querySelector<HTMLElement>(headerSelector);
      if (headerEl && resizeObs) { try { resizeObs.observe(headerEl); } catch {} attached = true; }
    }
    if (!weatherEl) {
      weatherEl = document.querySelector<HTMLElement>(weatherBoxSelector);
      if (weatherEl && resizeObs) { try { resizeObs.observe(weatherEl); } catch {} attached = true; }
    }
    if (attached) {
      debug('attached observers to elements');
      schedule();
    }
    // se entrambi presenti, possiamo fermare il polling
    if (headerEl && weatherEl) {
      clearInterval(lookupInterval);
    }
  }, 300);

  // Listener globali
  const onResize = () => schedule();
  const onOrientation = () => schedule();
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onOrientation);

  // Osserva il body intero per cambi layout (aperture/chiusure toasts, ecc.)
  try {
    mutationObs.observe(document.body, { childList: true, subtree: true, attributes: true });
  } catch {}

  // Primo calcolo immediato
  schedule();

  // Se già presenti al primo giro, aggancia subito i ResizeObserver
  (function attachIfReady() {
    headerEl = document.querySelector<HTMLElement>(headerSelector);
    weatherEl = document.querySelector<HTMLElement>(weatherBoxSelector);
    if (resizeObs) {
      try { if (headerEl) resizeObs.observe(headerEl); } catch {}
      try { if (weatherEl) resizeObs.observe(weatherEl); } catch {}
    }
  })();

  // ───────────────────────── Unbind ─────────────────────────
  const unbind: Unbind = () => {
    if (rafId != null) cancelAnimationFrame(rafId);
    try { clearInterval(lookupInterval); } catch {}
    try { mutationObs.disconnect(); } catch {}
    if (resizeObs) {
      try { if (headerEl) resizeObs.unobserve(headerEl); } catch {}
      try { if (weatherEl) resizeObs.unobserve(weatherEl); } catch {}
      try { resizeObs.disconnect(); } catch {}
    }
    window.removeEventListener('resize', onResize);
    window.removeEventListener('orientationchange', onOrientation);
    debug('unbind complete');
  };

  return unbind;
}
