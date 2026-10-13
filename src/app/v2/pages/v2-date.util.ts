const DAYS = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
const MONTHS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

/** "Sab 18 ott" da "2026-10-18" (senza dipendere dal fuso del browser). */
export function v2DayLabel(iso: string): { dow: string; day: string; month: string } {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  return { dow: DAYS[dt.getUTCDay()], day: String(d || ''), month: MONTHS[(m || 1) - 1] };
}
