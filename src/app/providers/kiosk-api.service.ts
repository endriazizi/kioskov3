import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { environment } from '../../environments/environment';
import type {
  KioskBannerDto,
  KioskPublicBusinessDto,
  KioskPublicEventDto,
} from '../interfaces/kiosk-api.interfaces';
import { kioskDevLog, kioskDevWarn } from '../utils/kiosk-dev-console';

/**
 * Client HTTP per le API pubbliche del backend PWA dedicate al totem kiosk.
 * Log espliciti con emoji per debug sul campo (come da convenzione progetto).
 */
@Injectable({ providedIn: 'root' })
export class KioskApiService {
  private readonly http = inject(HttpClient);

  /** Base URL backend (es. https://api.esempio.it) — stringa vuota = stesso origin della PWA kiosk */
  private apiBase(): string {
    return (environment.apiBaseUrl || '').replace(/\/$/, '');
  }

  private url(path: string): string {
    const p = path.startsWith('/') ? path : `/${path}`;
    const b = this.apiBase();
    return b ? `${b}${p}` : p;
  }

  /**
   * Risolve URL di asset eventualmente relativi al backend (es. /uploads/...).
   */
  resolveAssetUrl(path: string | null | undefined): string {
    if (path == null || path === '') return '';
    const p = String(path).trim();
    if (/^https?:\/\//i.test(p)) return p;
    if (p.startsWith('assets/') || p.startsWith('/assets/')) {
      return p.startsWith('/') ? p : `/${p}`;
    }
    const b = this.apiBase();
    if (!b) {
      return p.startsWith('/') ? p : `/${p}`;
    }
    return p.startsWith('/') ? `${b}${p}` : `${b}/${p}`;
  }

  getHome(): Observable<unknown> {
    kioskDevLog('🧭 [KioskAPI] GET /api/public-kiosk/home …');
    return this.http.get(this.url('/api/public-kiosk/home')).pipe(
      catchError((err) => {
        kioskDevWarn('⚠️ [KioskAPI] GET home fallita —', err?.message || err);
        return throwError(() => err);
      })
    );
  }

  getBusinessCategories(): Observable<unknown> {
    return this.http.get(this.url('/api/public-kiosk/business-categories')).pipe(
      catchError((err) => {
        kioskDevWarn('⚠️ [KioskAPI] GET business-categories fallita —', err?.message || err);
        return throwError(() => err);
      })
    );
  }

  /**
   * Calendario eventi comunali (tab Eventi).
   * Query: `year` (default anno corrente), oppure `from` / `to` (YYYY-MM-DD).
   */
  getEvents(params?: { year?: number; from?: string; to?: string; limit?: number }): Observable<unknown> {
    let hp = new HttpParams();
    if (params?.year != null) hp = hp.set('year', String(params.year));
    if (params?.from) hp = hp.set('from', params.from);
    if (params?.to) hp = hp.set('to', params.to);
    if (params?.limit != null) hp = hp.set('limit', String(params.limit));
    kioskDevLog('🧭 [KioskAPI] GET /api/public-kiosk/events …');
    return this.http.get(this.url('/api/public-kiosk/events'), { params: hp }).pipe(
      catchError((err) => {
        kioskDevWarn('⚠️ [KioskAPI] GET events fallita —', err?.message || err);
        return throwError(() => err);
      })
    );
  }

  getBusinesses(params?: { limit?: number; offset?: number; q?: string; category?: string }): Observable<unknown> {
    let hp = new HttpParams();
    if (params?.limit != null) hp = hp.set('limit', String(params.limit));
    if (params?.offset != null) hp = hp.set('offset', String(params.offset));
    if (params?.q) hp = hp.set('q', params.q);
    if (params?.category) hp = hp.set('category', params.category);
    kioskDevLog('🧭 [KioskAPI] GET /api/public-kiosk/businesses …');
    return this.http.get(this.url('/api/public-kiosk/businesses'), { params: hp }).pipe(
      catchError((err) => {
        // Compat produzione: alcuni deploy legacy espongono ancora /api/public-kiosk-businesses.
        if (err?.status === 404) {
          kioskDevWarn('↩️ [KioskAPI] fallback GET /api/public-kiosk-businesses …');
          return this.http.get(this.url('/api/public-kiosk-businesses'), { params: hp });
        }
        kioskDevWarn('⚠️ [KioskAPI] GET businesses fallita —', err?.message || err);
        return throwError(() => err);
      })
    );
  }

  getBusinessBySlug(slug: string): Observable<unknown> {
    const s = encodeURIComponent(slug);
    // #region agent log
    fetch('http://127.0.0.1:7727/ingest/c4e926a9-a777-4a16-97cd-643defec2cb0',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6f3cc8'},body:JSON.stringify({sessionId:'6f3cc8',runId:'pre-fix',hypothesisId:'H7',location:'kiosk-api.service.ts:getBusinessBySlug:request',message:'totem business-by-slug request',data:{slug:s,apiBase:this.apiBase(),url:this.url(`/api/public-kiosk/businesses/${s}`)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    kioskDevLog(`🧭 [KioskAPI] GET /api/public-kiosk/businesses/${s} …`);
    return this.http.get(this.url(`/api/public-kiosk/businesses/${s}`)).pipe(
      catchError((err) => {
        // Compat produzione: fallback endpoint legacy singola attività.
        if (err?.status === 404) {
          kioskDevWarn(`↩️ [KioskAPI] fallback GET /api/public-kiosk-businesses/${s} …`);
          return this.http.get(this.url(`/api/public-kiosk-businesses/${s}`));
        }
        kioskDevWarn('⚠️ [KioskAPI] GET business by slug fallita —', err?.message || err);
        return throwError(() => err);
      })
    );
  }

  /**
   * Feed principale poster home **verticali** (4:5) — stesso payload di `/home-posters` e chiave `banners` in GET `/home`.
   * Il totem deve usare questo endpoint come sorgente primaria per il carosello poster.
   */
  getBanners(): Observable<unknown> {
    kioskDevLog('🧭 [KioskAPI] GET /api/public-kiosk/banners …');
    return this.http.get(this.url('/api/public-kiosk/banners')).pipe(
      catchError((err) => {
        kioskDevWarn('⚠️ [KioskAPI] GET banners fallita —', err?.message || err);
        return throwError(() => err);
      })
    );
  }

  /**
   * Banner promozionali **orizzontali** (tabella `kiosk_banners`) — separati dai poster home verticali.
   * Non vanno mescolati al carosello 4:5: solo striscia secondaria / CTA interna.
   */
  getPromoBanners(): Observable<unknown> {
    kioskDevLog('🧭 [KioskAPI] GET /api/public-kiosk/promo-banners …');
    return this.http.get(this.url('/api/public-kiosk/promo-banners')).pipe(
      catchError((err) => {
        kioskDevWarn('⚠️ [KioskAPI] GET promo-banners fallita —', err?.message || err);
        return throwError(() => err);
      })
    );
  }

  /** Stesso elenco della chiave `homePosters` in GET /home (client leggeri / fallback). */
  getHomePosters(): Observable<unknown> {
    kioskDevLog('🧭 [KioskAPI] GET /api/public-kiosk/home-posters …');
    return this.http.get(this.url('/api/public-kiosk/home-posters')).pipe(
      catchError((err) => {
        kioskDevWarn('⚠️ [KioskAPI] GET home-posters fallita —', err?.message || err);
        return throwError(() => err);
      })
    );
  }

  /** Versione leggera feed home (poster + promo) per polling efficiente. */
  getFeedVersion(): Observable<unknown> {
    return this.http.get(this.url('/api/public-kiosk/feed-version')).pipe(
      catchError((err) => {
        kioskDevWarn('⚠️ [KioskAPI] GET feed-version fallita —', err?.message || err);
        return throwError(() => err);
      })
    );
  }

  /** Normalizza payload “business” singolo o lista */
  unwrapEventsList(raw: unknown): KioskPublicEventDto[] {
    const r = raw as Record<string, unknown> | unknown[] | null;
    if (!r) return [];
    const inner = (r as Record<string, unknown>)?.data ?? (r as Record<string, unknown>)?.items ?? r;
    if (Array.isArray(inner)) return inner as KioskPublicEventDto[];
    return [];
  }

  unwrapBusinessList(raw: unknown): KioskPublicBusinessDto[] {
    const r = raw as Record<string, unknown> | unknown[] | null;
    if (!r) return [];
    const inner = (r as Record<string, unknown>)?.data ?? (r as Record<string, unknown>)?.items ?? r;
    if (Array.isArray(inner)) return inner as KioskPublicBusinessDto[];
    if (Array.isArray((inner as Record<string, unknown>)?.businesses)) {
      return (inner as { businesses: KioskPublicBusinessDto[] }).businesses;
    }
    if (Array.isArray((inner as Record<string, unknown>)?.speakers)) {
      return (inner as { speakers: KioskPublicBusinessDto[] }).speakers;
    }
    return [];
  }

  unwrapBusinessSingle(raw: unknown): KioskPublicBusinessDto | null {
    const r = raw as Record<string, unknown> | null;
    if (!r) return null;
    const inner = (r.data ?? r.business ?? r.payload ?? r) as Record<string, unknown> | KioskPublicBusinessDto;
    if (inner && typeof inner === 'object' && 'name' in inner) {
      return inner as KioskPublicBusinessDto;
    }
    return null;
  }

  unwrapBanners(raw: unknown): KioskBannerDto[] {
    const r = raw as Record<string, unknown> | unknown[] | null;
    if (!r) return [];
    const inner = (r as Record<string, unknown>)?.data ?? (r as Record<string, unknown>)?.items ?? r;
    if (Array.isArray(inner)) return inner as KioskBannerDto[];
    if (Array.isArray((inner as Record<string, unknown>)?.banners)) {
      return (inner as { banners: KioskBannerDto[] }).banners;
    }
    return [];
  }

  /**
   * Estrae i poster home da GET /api/public-kiosk/home (strutture wrapper diverse).
   * Ordine: campi dedicati → home.* → fallback su banners se presenti solo lì.
   */
  unwrapHomePosters(raw: unknown): KioskBannerDto[] {
    const r = raw as Record<string, unknown> | null;
    if (!r) return [];
    const root = (r.data ?? r.payload ?? r) as Record<string, unknown>;
    const home = root.home as Record<string, unknown> | undefined;
    const pick = (...candidates: unknown[]): KioskBannerDto[] => {
      for (const c of candidates) {
        if (Array.isArray(c) && c.length) return c as KioskBannerDto[];
      }
      return [];
    };
    return pick(
      root.homePosters,
      root.home_posters,
      root.kioskHomePosters,
      root.posterHome,
      home?.posters,
      home?.banners,
      home?.homePosters,
      root.posters,
      root.banners
    );
  }

  /** Risposta GET /api/public-kiosk/home-posters → `{ items: [...] }` (o `data.items`). */
  unwrapHomePostersItems(raw: unknown): KioskBannerDto[] {
    const r = raw as Record<string, unknown> | null;
    if (!r) return [];
    const top = r.items;
    if (Array.isArray(top)) return top as KioskBannerDto[];
    const data = r.data as Record<string, unknown> | undefined;
    if (data && Array.isArray(data.items)) return data.items as KioskBannerDto[];
    if (Array.isArray(r.data)) return r.data as KioskBannerDto[];
    return [];
  }

  /** Alias: GET `/promo-banners` usa lo stesso wrapper `{ ok, items }` dei banner orizzontali. */
  unwrapPromoBanners(raw: unknown): KioskBannerDto[] {
    return this.unwrapHomePostersItems(raw);
  }

  /**
   * Regole ufficiali home: attività approvata, poster approvato, poster attivo.
   * Flag assenti → si assume ok (retrocompatibilità con API senza campi).
   */
  isEligibleKioskHomePoster(b: KioskBannerDto): boolean {
    const o = b as Record<string, unknown>;
    const nestedPoster = b.poster ?? (o.poster as KioskBannerDto['poster']);
    const biz = o.business as Record<string, unknown> | undefined;

    const activityOff =
      b.activityApproved === false ||
      b.businessApproved === false ||
      o.activity_approved === false ||
      o.business_approved === false ||
      (biz && biz.approved === false);

    if (activityOff) return false;

    const posterOff =
      b.approved === false ||
      b.posterApproved === false ||
      (nestedPoster && nestedPoster.approved === false) ||
      o.poster_approved === false;

    if (posterOff) return false;

    const inactive =
      b.active === false ||
      b.isActive === false ||
      b.posterActive === false ||
      o.is_active === false ||
      o.poster_active === false ||
      (nestedPoster && nestedPoster.active === false);

    if (inactive) return false;

    return true;
  }

  /** Solo attività con piano premium (totem: poster home / elenco da businesses). */
  isPremiumTotemBusiness(b: KioskPublicBusinessDto): boolean {
    if (b.isPremium === true) return true;
    const t = String(b.listingTier ?? b.listing_tier ?? '')
      .trim()
      .toLowerCase();
    return t === 'premium';
  }

  /**
   * Poster home: eleggibile solo se l’attività è premium (campi da GET /banners / home-posters).
   * Senza tier nel payload → non premium (retrocompat: backend deve inviare listing_tier).
   */
  isPremiumKioskHomePoster(b: KioskBannerDto): boolean {
    const o = b as Record<string, unknown>;
    if (b.isPremium === true || o.is_premium === true) return true;
    const t = String(
      b.listingTier ?? b.listing_tier ?? o.listingTier ?? o.listing_tier ?? ''
    )
      .trim()
      .toLowerCase();
    if (t === 'premium') return true;
    const biz = o.business as Record<string, unknown> | undefined;
    if (biz) {
      if (biz.isPremium === true || biz.is_premium === true) return true;
      const bt = String(biz.listingTier ?? biz.listing_tier ?? '')
        .trim()
        .toLowerCase();
      if (bt === 'premium') return true;
    }
    return false;
  }

  /**
   * Filtra attività approvate/pubblicate per il totem (se i flag mancano, si mostra tutto).
   */
  filterPublishedForKiosk(list: KioskPublicBusinessDto[]): KioskPublicBusinessDto[] {
    return list.filter((b) => {
      if (b.published === false) return false;
      if (b.approved === false) return false;
      return true;
    });
  }
}
