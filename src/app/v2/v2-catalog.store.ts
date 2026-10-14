import { Injectable, NgZone, OnDestroy, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../environments/environment';
import type { Speaker } from '../interfaces/conference.interfaces';
import type { KioskPublicEventDto } from '../interfaces/kiosk-api.interfaces';
import { ConferenceService } from '../providers/conference.service';
import { KioskApiService } from '../providers/kiosk-api.service';
import { kioskDevLog, kioskDevWarn } from '../utils/kiosk-dev-console';
import { V2Poster, mapBannersToPosters } from './v2-poster.util';

export interface V2Event {
  id: string;
  title: string;
  description: string;
  location: string;
  timeLabel: string;
  dateIso: string;
  dateEndIso: string;
  posterUrl: string;
}

/** Ultimo catalogo pubblico valido salvato sul dispositivo (solo dati pubblici già approvati). */
interface V2Snapshot {
  savedAt: number;
  businesses: Speaker[];
  events: V2Event[];
  posters: V2Poster[];
  categories: string[];
}

const SNAPSHOT_KEY = 'kiosk.v2.catalog.v1';
/** Oltre questa età lo snapshot locale non viene mostrato: meglio vuoto che contenuti forse revocati. */
const SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
/** Il backend non emette eventi kiosk: attività ed eventi si riallineano a intervalli. */
const CATALOG_REFRESH_MS = 2 * 60 * 1000;

/**
 * Store a Signals del totem v2. Usa le API pubbliche e le regole già presenti
 * (`KioskApiService`, `ConferenceService.mapKioskBusinessToSpeaker`), senza cache permanente:
 * un errore di rete conserva l'ultimo catalogo valido invece di svuotarlo.
 */
@Injectable({ providedIn: 'root' })
export class V2CatalogStore implements OnDestroy {
  private readonly api = inject(KioskApiService);
  private readonly conference = inject(ConferenceService);
  private readonly zone = inject(NgZone);

  readonly businesses = signal<Speaker[]>([]);
  readonly events = signal<V2Event[]>([]);
  readonly posters = signal<V2Poster[]>([]);
  readonly categories = signal<string[]>([]);
  readonly loaded = signal(false);
  /** true quando l'ultimo tentativo di aggiornamento è fallito e si mostrano dati precedenti. */
  readonly stale = signal(false);
  readonly lastSyncAt = signal<number | null>(null);
  /** Nomi delle attività comparse nell'ultimo aggiornamento (per un avviso non invasivo). */
  readonly lastAdded = signal<{ names: string[]; slugs: string[]; at: number } | null>(null);
  /** Slug rimossi nell'ultimo aggiornamento: una scheda aperta su uno di questi va chiusa. */
  readonly lastRemoved = signal<{ slugs: string[]; at: number } | null>(null);

  readonly featured = computed(() => this.businesses().filter((b) => b.isPremium || b.showInHome));

  private started = false;
  private feedTimer?: ReturnType<typeof setInterval>;
  private catalogTimer?: ReturnType<typeof setInterval>;
  private feedVersion = '';
  private inFlight = false;
  /** Un avviso arrivato durante un caricamento in corso: si ricarica di nuovo appena finisce. */
  private rerun: string | null = null;
  private readonly onOnline = () => void this.refresh('online');
  private readonly onVisible = () => {
    if (document.visibilityState === 'visible') void this.refresh('visible');
  };

  /** Idempotente: un solo set di timer e listener per tutta l'app. */
  start(): void {
    if (this.started) return;
    this.started = true;
    this.restoreSnapshot();
    void this.refresh('boot');
    this.zone.runOutsideAngular(() => {
      const pollMs = Math.max(5000, Number(environment.kioskFeedVersionPollMs) || 12_000);
      this.feedTimer = setInterval(() => void this.checkFeedVersion(), pollMs);
      this.catalogTimer = setInterval(() => void this.refresh('interval'), CATALOG_REFRESH_MS);
      window.addEventListener('online', this.onOnline);
      document.addEventListener('visibilitychange', this.onVisible);
    });
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    clearInterval(this.feedTimer);
    clearInterval(this.catalogTimer);
    window.removeEventListener('online', this.onOnline);
    document.removeEventListener('visibilitychange', this.onVisible);
  }

  ngOnDestroy(): void {
    this.stop();
  }

  /** Attività comparse da meno di 30 s: la card mostra il badge "Nuovo". */
  isRecentlyAdded(b: Speaker, now = Date.now()): boolean {
    const a = this.lastAdded();
    return !!a && now - a.at < 30_000 && a.slugs.includes((b.slug || b.id).toLowerCase());
  }

  findBySlug(slug: string): Speaker | undefined {
    const s = slug.trim().toLowerCase();
    return this.businesses().find((b) => (b.slug || b.id).toLowerCase() === s);
  }

  /** Ricarica attività, eventi, categorie e poster. In caso di errore tiene i dati precedenti. */
  async refresh(reason: string): Promise<void> {
    if (this.inFlight) {
      this.rerun = reason;
      return;
    }
    this.inFlight = true;
    try {
      const [bizRaw, evRaw, catRaw, posters] = await Promise.all([
        firstValueFrom(this.api.getBusinesses({ limit: 200 }, { silent: true })),
        firstValueFrom(this.api.getEvents({ year: new Date().getFullYear(), limit: 800 })).catch(() => null),
        firstValueFrom(this.api.getBusinessCategories()).catch(() => null),
        this.loadPosters().catch(() => null),
      ]);
      const businesses = this.api
        .filterPublishedForKiosk(this.api.unwrapBusinessList(bizRaw))
        .map((dto) => this.conference.mapKioskBusinessToSpeaker(dto))
        .filter((b) => b.showInPoi !== false && !!b.name)
        .sort((a, b) => a.name.localeCompare(b.name, 'it', { sensitivity: 'base' }));

      this.zone.run(() => {
        this.applyBusinesses(businesses, reason);
        if (evRaw) this.events.set(this.mapEvents(this.api.unwrapEventsList(evRaw)));
        const cats = ((catRaw as { items?: unknown[] } | null)?.items ?? []).map((c) => String(c).trim()).filter(Boolean);
        this.categories.set(this.mergeCategories(cats, businesses));
        if (posters) this.posters.set(posters);
        this.stale.set(false);
        this.loaded.set(true);
        this.lastSyncAt.set(Date.now());
      });
      this.saveSnapshot();
      kioskDevLog('🔄 [v2] catalogo aggiornato', { reason, businesses: businesses.length });
    } catch (e) {
      kioskDevWarn('⚠️ [v2] aggiornamento catalogo fallito, resto sull\'ultimo valido', reason, e);
      this.zone.run(() => {
        this.stale.set(true);
        this.loaded.set(true);
      });
    } finally {
      this.inFlight = false;
      const again = this.rerun;
      this.rerun = null;
      if (again) void this.refresh(again);
    }
  }

  private applyBusinesses(next: Speaker[], reason: string): void {
    const prev = this.businesses();
    const key = (b: Speaker) => (b.slug || b.id).toLowerCase();
    if (prev.length && reason !== 'boot') {
      const prevKeys = new Set(prev.map(key));
      const nextKeys = new Set(next.map(key));
      const added = next.filter((b) => !prevKeys.has(key(b)));
      const removed = prev.filter((b) => !nextKeys.has(key(b)));
      if (added.length) this.lastAdded.set({ names: added.map((b) => b.name), slugs: added.map(key), at: Date.now() });
      if (removed.length) this.lastRemoved.set({ slugs: removed.map(key), at: Date.now() });
    }
    this.businesses.set(next);
  }

  /** `feed-version` esistente: cambia quando cambiano poster o banner approvati. */
  private async checkFeedVersion(): Promise<void> {
    try {
      const raw = (await firstValueFrom(this.api.getFeedVersion())) as { version?: string } | null;
      const v = String(raw?.version ?? '');
      if (!v) return;
      if (this.feedVersion && v !== this.feedVersion) {
        kioskDevLog('🔄 [v2] feed-version cambiata, ricarico');
        await this.refresh('feed-version');
      } else if (this.stale()) {
        await this.refresh('recovery');
      }
      this.feedVersion = v;
    } catch {
      this.zone.run(() => this.stale.set(true));
    }
  }

  private async loadPosters(): Promise<V2Poster[]> {
    const raw = await firstValueFrom(this.api.getBanners({ silent: true }));
    let list = this.api.unwrapHomePostersItems(raw);
    if (!list.length) list = this.api.unwrapBanners(raw);
    if (!list.length) list = this.api.unwrapHomePostersItems(await firstValueFrom(this.api.getHomePosters({ silent: true })));
    return mapBannersToPosters(list, this.api);
  }

  private mapEvents(list: KioskPublicEventDto[]): V2Event[] {
    const today = new Date().toISOString().slice(0, 10);
    return list
      .map((e, i) => {
        const dateIso = String(e.event_date ?? e.eventDate ?? '').slice(0, 10);
        const end = String(e.event_date_end ?? e.eventDateEnd ?? '').slice(0, 10);
        const poster = e.poster_url ?? e.posterUrl ?? '';
        return {
          id: String(e.id ?? e.slug ?? i),
          title: String(e.title ?? '').trim(),
          description: String(e.description ?? '').trim(),
          location: String(e.location ?? '').trim(),
          timeLabel: String(e.time_label ?? e.timeLabel ?? '').trim(),
          dateIso,
          dateEndIso: end,
          posterUrl: poster ? this.api.resolveAssetUrl(poster) : '',
        };
      })
      .filter((e) => e.title && /^\d{4}-\d{2}-\d{2}$/.test(e.dateIso) && (e.dateEndIso || e.dateIso) >= today)
      .sort((a, b) => a.dateIso.localeCompare(b.dateIso));
  }

  private mergeCategories(fromApi: string[], businesses: Speaker[]): string[] {
    const counts = new Map<string, number>();
    for (const b of businesses) {
      const c = (b.category || '').trim();
      if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    // Solo categorie con almeno un'attività visibile: un filtro vuoto è un vicolo cieco sul totem.
    return [...new Set([...fromApi, ...counts.keys()])]
      .filter((c) => (counts.get(c) ?? 0) > 0)
      .sort((a, b) => a.localeCompare(b, 'it'));
  }

  private restoreSnapshot(): void {
    try {
      const raw = localStorage.getItem(SNAPSHOT_KEY);
      if (!raw) return;
      const snap = JSON.parse(raw) as V2Snapshot;
      if (!snap?.savedAt || Date.now() - snap.savedAt > SNAPSHOT_MAX_AGE_MS) return;
      this.businesses.set(snap.businesses ?? []);
      this.events.set(snap.events ?? []);
      this.posters.set(snap.posters ?? []);
      this.categories.set(snap.categories ?? []);
      this.lastSyncAt.set(snap.savedAt);
      this.loaded.set(true);
    } catch {
      /* snapshot illeggibile: si parte dalle API */
    }
  }

  private saveSnapshot(): void {
    try {
      const snap: V2Snapshot = {
        savedAt: Date.now(),
        businesses: this.businesses(),
        events: this.events(),
        posters: this.posters(),
        categories: this.categories(),
      };
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snap));
    } catch {
      /* quota o storage non disponibile: nessun salvataggio */
    }
  }
}
