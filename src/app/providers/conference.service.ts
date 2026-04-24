import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import {
  ConferenceData,
  Group,
  MapLocation,
  ScheduleDay,
  Session,
  Speaker,
} from '../interfaces/conference.interfaces';
import type { KioskPublicBusinessDto, KioskPublicEventDto } from '../interfaces/kiosk-api.interfaces';
import { UserService } from './user.service';
import { KioskApiService } from './kiosk-api.service';
import { environment } from '../../environments/environment';
import { kioskDevLog, kioskDevWarn } from '../utils/kiosk-dev-console';

@Injectable({
  providedIn: 'root',
})
export class ConferenceService {
  http = inject(HttpClient);
  private kioskApi = inject(KioskApiService);
  user = inject(UserService);
  data: ConferenceData | null = null;

  load() {
    if (this.data) {
      return of(this.data);
    }
    if (!environment.useKioskPublicApi) {
      kioskDevLog('📁 [Conference] useKioskPublicApi=false → solo JSON locale');
      return this.loadLocalJson();
    }
    return this.loadFromRestOnly().pipe(
      catchError((err) => {
        kioskDevWarn('❌ [Conference] GET /api/public-kiosk/businesses fallita', err);
        return of(
          this.processData({
            schedule: [],
            speakers: [],
            tracks: [],
            map: [],
          })
        );
      })
    );
  }

  /**
   * REST: attività (`/businesses`) + calendario eventi (`/events`) per la tab Eventi.
   */
  private loadFromRestOnly(): Observable<ConferenceData> {
    const year = new Date().getFullYear();
    const businesses$ = this.kioskApi.getBusinesses({ limit: 200 }).pipe(
      map((bizRaw) =>
        this.kioskApi.filterPublishedForKiosk(this.kioskApi.unwrapBusinessList(bizRaw))
      ),
      catchError(() => of([] as KioskPublicBusinessDto[]))
    );
    const events$ = this.kioskApi.getEvents({ year, limit: 800 }).pipe(
      map((raw) => this.kioskApi.unwrapEventsList(raw)),
      catchError(() => of([] as KioskPublicEventDto[]))
    );
    return forkJoin({ list: businesses$, ev: events$ }).pipe(
      map(({ list, ev }) => {
        const speakers = list.map((b) => this.mapKioskBusinessToSpeaker(b));
        const map = this.buildMapFromSpeakers(speakers);
        const schedule = this.buildScheduleFromEvents(ev);
        kioskDevLog(
          '✅ [Conference] REST —',
          speakers.length,
          'attività,',
          schedule[0]?.groups?.length ?? 0,
          'giorni eventi,',
          map.length,
          'punti mappa'
        );
        return this.processData({
          schedule,
          speakers,
          tracks: [{ name: 'Eventi', icon: 'calendar-outline' }],
          map,
        });
      })
    );
  }

  private formatItDate(d: string): string {
    const [y, m, day] = d.split('-').map((x) => parseInt(x, 10));
    const dt = new Date(y, m - 1, day);
    return dt.toLocaleDateString('it-IT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  private buildScheduleFromEvents(rows: KioskPublicEventDto[]): ScheduleDay[] {
    if (!rows?.length) {
      return [
        {
          date: String(new Date().getFullYear()),
          groups: [{ time: 'Calendario', sessions: [] }],
        },
      ];
    }
    const byDay = new Map<string, KioskPublicEventDto[]>();
    for (const r of rows) {
      const d = String(r.event_date ?? r.eventDate ?? '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
      if (!byDay.has(d)) byDay.set(d, []);
      byDay.get(d)!.push(r);
    }
    const sortedDays = [...byDay.keys()].sort();
    const groups: Group[] = [];
    for (const d of sortedDays) {
      const label = this.formatItDate(d);
      const list = (byDay.get(d) ?? []).slice().sort((a, b) => this.eventTimeKey(a) - this.eventTimeKey(b));
      const sessions: Session[] = list.map((r, i) => {
        const idNum = r.id != null ? String(r.id) : `${d}-${i}`;
        const posterRaw = r.poster_url ?? r.posterUrl ?? '';
        const time = String(r.time_label ?? r.timeLabel ?? '—').trim() || '—';
        return {
          id: `evt-${idNum}`,
          name: String(r.title ?? ''),
          location: String(r.location ?? 'Castelraimondo'),
          description: String(r.description ?? ''),
          speakerNames: [],
          timeStart: time,
          timeEnd: '',
          tracks: ['Eventi'],
          posterUrl: posterRaw ? this.kioskApi.resolveAssetUrl(String(posterRaw)) : undefined,
          eventDateIso: d,
          eventDateEndIso: r.event_date_end
            ? String(r.event_date_end).slice(0, 10)
            : r.eventDateEnd
              ? String(r.eventDateEnd).slice(0, 10)
              : undefined,
        };
      });
      groups.push({ time: label, sessions });
    }
    return [{ date: String(new Date().getFullYear()), groups }];
  }

  private eventTimeKey(r: KioskPublicEventDto): number {
    const t = String(r.time_label ?? r.timeLabel ?? '').trim();
    const m = t.match(/(\d{1,2})[.:](\d{2})/);
    if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
    return 99999;
  }

  private sessionTimeSortKey(session: Session): number {
    const t = String(session.timeStart || '').trim();
    const m = t.match(/(\d{1,2})[.:](\d{2})/);
    if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
    return 99999;
  }

  /** Marker da coordinate DB; se nessuno, centro Castelraimondo. */
  private buildMapFromSpeakers(speakers: Speaker[]): MapLocation[] {
    const out: MapLocation[] = [];
    let first = true;
    let n = 0;
    for (const s of speakers) {
      if (s.showInMap === false) continue;
      if (s.lat != null && s.lng != null && Number.isFinite(s.lat) && Number.isFinite(s.lng)) {
        n += 1;
        out.push({
          id: n,
          name: s.name,
          lat: s.lat,
          lng: s.lng,
          icon: (s.mapMarkerUrl && String(s.mapMarkerUrl).trim()) || s.profilePic || '',
          slug: s.slug || String(s.id),
          center: first,
        });
        first = false;
      }
    }
    if (!out.length) {
      return [
        {
          id: 1,
          name: 'Castelraimondo',
          lat: 43.2075153,
          lng: 13.0563971,
          center: true,
        },
      ];
    }
    return out;
  }

  private loadLocalJson(): Observable<ConferenceData> {
    return this.http
      .get<ConferenceData>('assets/data/data.json')
      .pipe(map(this.processData, this));
  }

  /**
   * Mappa un’attività backend sul modello `Speaker` (es. dettaglio da GET businesses/:slug).
   */
  mapKioskBusinessToSpeaker(dto: KioskPublicBusinessDto): Speaker {
    const slug = String(dto.slug ?? '').trim();
    const id = slug || String(dto.id ?? '').trim();
    const website =
      [dto.website, dto.url, dto.sito]
        .map((x) => (x == null ? '' : String(x).trim()))
        .find((s) => s.length > 0) ?? '';
    const galleryRaw = [...(dto.gallery ?? []), ...(dto.images ?? [])].filter(Boolean);
    const gallery = Array.from(
      new Set(galleryRaw.map((u) => this.kioskApi.resolveAssetUrl(u)).filter(Boolean))
    );

    const logo = this.kioskApi.resolveAssetUrl(
      (dto.profilePic ?? dto.avatarUrl ?? dto.logo ?? dto.logoUrl) as string | undefined
    );
    const cover = this.kioskApi.resolveAssetUrl((dto.cover ?? dto.coverUrl) as string | undefined);
    // Policy visuale kiosk: niente fallback cover -> logo/avatar.
    const profilePic = this.kioskApi.resolveAssetUrl(
      (dto.profilePic ?? dto.avatarUrl ?? dto.logo ?? dto.logoUrl) as string | undefined
    );

    const o = dto as Record<string, unknown>;
    const mapMarkerRaw = o.map_marker_url ?? o.mapMarkerUrl ?? (dto as KioskPublicBusinessDto).mapMarkerUrl;
    const mapMarkerUrl = mapMarkerRaw
      ? this.kioskApi.resolveAssetUrl(String(mapMarkerRaw))
      : undefined;
    const aboutRaw =
      dto.about ??
      dto.htmlAbout ??
      o.full_description ??
      o.fullDescription ??
      '';
    const descRaw = dto.description ?? o.short_description ?? o.shortDescription ?? '';
    const hoursRaw =
      dto.openingHours ??
      dto.hours ??
      this.openingHoursFromBackend(o.opening_hours_json ?? o.openingHoursJson);

    const la = dto.latitude ?? dto.lat ?? (o.latitude as number | undefined);
    const lo = dto.longitude ?? dto.lng ?? (o.longitude as number | undefined);
    const lat = la != null && Number.isFinite(Number(la)) ? Number(la) : undefined;
    const lng = lo != null && Number.isFinite(Number(lo)) ? Number(lo) : undefined;

    const tierRaw =
      dto.listingTier ??
      dto.listing_tier ??
      (o.listingTier as string | undefined) ??
      (o.listing_tier as string | undefined);
    const listingTier =
      tierRaw != null && String(tierRaw).trim() ? String(tierRaw).trim().toLowerCase() : undefined;
    const isPremium =
      dto.isPremium === true ||
      listingTier === 'premium' ||
      (o.isPremium as boolean | undefined) === true;
    const showInPoi = dto.showInPoi ?? dto.show_in_poi ?? true;
    const showInMap = dto.showInMap ?? dto.show_in_map ?? true;
    const showInHome = dto.showInHome ?? dto.show_in_home ?? (listingTier === 'premium');
    // #region agent log
    fetch('http://127.0.0.1:7727/ingest/c4e926a9-a777-4a16-97cd-643defec2cb0',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6f3cc8'},body:JSON.stringify({sessionId:'6f3cc8',runId:'post-fix',hypothesisId:'H11',location:'conference.service.ts:mapKioskBusinessToSpeaker',message:'totem dto image mapping',data:{slug:String(dto.slug||''),dtoLogo:String((dto.logo ?? dto.logoUrl ?? '') as string),dtoCover:String((dto.cover ?? dto.coverUrl ?? '') as string),dtoProfilePic:String((dto.profilePic ?? dto.avatarUrl ?? '') as string),mappedLogo:logo||'',mappedCover:cover||'',mappedProfilePic:profilePic||''},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    return {
      name: dto.name ?? '',
      logo: logo || '',
      profilePic: profilePic || '/assets/img/kiosk-poster-placeholder.svg',
      instagram: '',
      twitter: '',
      about: String(aboutRaw ?? ''),
      title: '',
      location: String(dto.city ?? o.location ?? '').trim(),
      email: dto.email ?? '',
      phone: dto.phone ?? '',
      sito: website,
      foto: '',
      category: dto.category ?? '',
      description: String(descRaw ?? ''),
      address: dto.address ?? '',
      openingHours: String(hoursRaw ?? ''),
      id,
      slug: slug || undefined,
      coverUrl: cover || undefined,
      gallery: gallery.length ? gallery : undefined,
      lat,
      lng,
      listingTier: listingTier || undefined,
      isPremium: isPremium || undefined,
      mapMarkerUrl: mapMarkerUrl || undefined,
      showInPoi: Boolean(showInPoi),
      showInMap: Boolean(showInMap),
      showInHome: Boolean(showInHome),
    };
  }

  /** Fallback se il backend espone solo `opening_hours_json` (compat layer). */
  private openingHoursFromBackend(raw: unknown): string {
    if (raw == null) return '';
    if (typeof raw === 'string') {
      const t = raw.trim();
      if (!t.startsWith('{')) return t;
      try {
        return this.openingHoursFromBackend(JSON.parse(t));
      } catch {
        return t;
      }
    }
    if (typeof raw === 'object' && raw != null) {
      const r = raw as Record<string, unknown>;
      const c = r['cena'];
      const n = r['note'];
      const d = r['display'];
      if (typeof d === 'string' && d.trim()) return d.trim();
      if (typeof c === 'string' && typeof n === 'string') return `${c.trim()} — ${n.trim()}`;
      if (typeof c === 'string') return c.trim();
    }
    return '';
  }

  processData(data: ConferenceData): ConferenceData {
    // just some good 'ol JS fun with objects and arrays
    // build up the data by linking speakers to sessions
    this.data = data;

    if ((!this.data.map || !this.data.map.length) && this.data.speakers?.length) {
      const m = this.buildMapFromSpeakers(this.data.speakers);
      if (m.length) this.data.map = m;
    }

    // loop through each day in the schedule
    this.data.schedule.forEach((day: ScheduleDay) => {
      // loop through each timeline group in the day
      day.groups.forEach((group: Group) => {
        // loop through each session in the timeline group
        group.sessions.forEach((session: Session) => {
          session.speakers = [];
          if (session.speakerNames) {
            session.speakerNames.forEach((speakerName: string) => {
              const speaker = this.data!.speakers.find(
                (s: Speaker) => s.name === speakerName
              );
              if (speaker) {
                session.speakers.push(speaker);
                speaker.sessions = speaker.sessions || [];
                speaker.sessions.push(session);
              }
            });
          }
        });
      });
    });

    return this.data;
  }

  getTimeline(
    dayIndex: number,
    queryText = '',
    excludeTracks: string[] = [],
    segment = 'all'
  ) {
    return this.load().pipe(
      map((data: ConferenceData) => {
        const day = data.schedule[dayIndex];
        if (!day) {
          return {
            date: '',
            groups: [],
            shownSessions: 0,
          } as ScheduleDay;
        }
        day.shownSessions = 0;

        queryText = queryText.toLowerCase().replace(/,|\.|-/g, ' ');
        const queryWords = queryText.split(' ').filter((w) => !!w.trim().length);

        day.groups.forEach((group: Group) => {
          group.hide = true;

          // Sort sessions within each group by start time
          group.sessions.sort(
            (a, b) => this.sessionTimeSortKey(a) - this.sessionTimeSortKey(b)
          );

          group.sessions.forEach((session: Session) => {
            // check if this session should show or not
            this.filterSession(session, queryWords, excludeTracks, segment);

            if (!session.hide) {
              // if this session is not hidden then this group should show
              group.hide = false;
              day.shownSessions!++;
            }
          });
        });

        return day;
      })
    );
  }

  filterSession(
    session: Session,
    queryWords: string[],
    excludeTracks: string[],
    segment: string
  ) {
    let matchesQueryText = false;
    if (queryWords.length) {
      // of any query word is in the session name than it passes the query test
      queryWords.forEach((queryWord: string) => {
        if (session.name.toLowerCase().indexOf(queryWord) > -1) {
          matchesQueryText = true;
        }
      });
    } else {
      // if there are no query words then this session passes the query test
      matchesQueryText = true;
    }

    let matchesTracks = false;
    if (!session.tracks?.length) {
      matchesTracks = true;
    } else {
      session.tracks.forEach((trackName: string) => {
        if (excludeTracks.indexOf(trackName) === -1) {
          matchesTracks = true;
        }
      });
    }

    // if the segment is 'favorites', but session is not a user favorite
    // then this session does not pass the segment test
    let matchesSegment = false;
    if (segment === 'favorites') {
      if (this.user.hasFavorite(session.name)) {
        matchesSegment = true;
      }
    } else {
      matchesSegment = true;
    }

    // all tests must be true if it should not be hidden
    session.hide = !(matchesQueryText && matchesTracks && matchesSegment);
  }

  getSpeakers() {
    return this.load().pipe(map((data: ConferenceData) => data.speakers));
  }

  getTracks() {
    return this.load().pipe(map((data: ConferenceData) => data.tracks));
  }

  getMap() {
    return this.load().pipe(map((data: ConferenceData) => data.map));
  }
}
