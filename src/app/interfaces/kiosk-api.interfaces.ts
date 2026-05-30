/**
 * DTO flessibili per le risposte GET /api/public-kiosk/*
 * (il backend PWA può wrappare in { data } o restituire array diretti — normalizziamo in kiosk-api.service).
 */
export interface KioskPublicBusinessDto {
  slug?: string;
  id?: string | number;
  name?: string;
  logo?: string | null;
  logoUrl?: string | null;
  cover?: string | null;
  coverUrl?: string | null;
  profilePic?: string | null;
  avatarUrl?: string | null;
  category?: string | null;
  description?: string | null;
  about?: string | null;
  htmlAbout?: string | null;
  /** Alias backend (`kiosk-public.service` → totem) */
  full_description?: string | null;
  fullDescription?: string | null;
  short_description?: string | null;
  shortDescription?: string | null;
  city?: string | null;
  location?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  openingHours?: string | null;
  hours?: string | null;
  opening_hours_json?: unknown;
  openingHoursJson?: unknown;
  website?: string | null;
  url?: string | null;
  sito?: string | null;
  gallery?: string[] | null;
  images?: string[] | null;
  /** Se false, l’attività non va mostrata in lista totem */
  published?: boolean | null;
  /** Se false, non approvata */
  approved?: boolean | null;
  latitude?: number | null;
  longitude?: number | null;
  lat?: number | null;
  lng?: number | null;
  /** Piano commerciale listing (backend `listing_tier`) */
  listing_tier?: string | null;
  listingTier?: string | null;
  isPremium?: boolean | null;
  /** Origine riga: account kiosk vs directory comunale */
  source?: string | null;
  /** Icona marker mappa totem (solo se moderata `approved`) */
  map_marker_url?: string | null;
  mapMarkerUrl?: string | null;
  show_in_poi?: boolean | null;
  showInPoi?: boolean | null;
  show_in_map?: boolean | null;
  showInMap?: boolean | null;
  show_in_home?: boolean | null;
  showInHome?: boolean | null;
}

/** GET /api/public-kiosk/events — evento comunale (calendario totem) */
export interface KioskPublicEventDto {
  id?: number;
  slug?: string;
  title?: string;
  description?: string | null;
  event_date?: string;
  eventDate?: string;
  event_date_end?: string | null;
  eventDateEnd?: string | null;
  time_label?: string | null;
  timeLabel?: string | null;
  location?: string | null;
  poster_url?: string | null;
  posterUrl?: string | null;
  sort_order?: number;
}

export interface KioskBannerDto {
  id?: string | number;
  /** Slug attività (1 poster = 1 attività) — usato per /app/tabs/speakers/speaker-details/:slug */
  slug?: string | null;
  activitySlug?: string | null;
  businessSlug?: string | null;
  /** Alias API snake_case */
  business_slug?: string | null;
  /**
   * Da `listPublicHomePosters` (enea_be): navigazione interna verso dettaglio attività.
   * Preferire insieme a `target_type: 'business_detail'`.
   */
  target_type?: string | null;
  target_value?: string | null;
  /** Banner kiosk: tipo CTA (es. link interno vs esterno) */
  cta_type?: string | null;
  cta_value?: string | null;
  speakerId?: string | null;
  /** Nome commerciale (testo opzionale sotto il poster) */
  businessName?: string | null;
  business_name?: string | null;
  business_cover_url?: string | null;
  business_logo_url?: string | null;
  /** Testi opzionali sul poster (non sostituiscono il contenuto del dettaglio) */
  title?: string | null;
  subtitle?: string | null;
  /** Immagine poster home (verticale consigliata 4:5) */
  homePosterUrl?: string | null;
  posterUrl?: string | null;
  /** URL assoluto o path relativo al backend */
  imageUrl?: string | null;
  /** Alias API snake_case (stesso ruolo di imageUrl) */
  image_url?: string | null;
  src?: string | null;
  url?: string | null;
  mediaType?: 'image' | 'video' | string | null;
  media_type?: 'image' | 'video' | string | null;
  poster_media_type?: 'image' | 'video' | string | null;
  videoUrl?: string | null;
  video_url?: string | null;
  media_url?: string | null;
  public_url?: string | null;
  poster_thumb_url?: string | null;
  posterThumbUrl?: string | null;
  mime_type?: string | null;
  mimeType?: string | null;
  /**
   * Stato poster/attività per home kiosk. Se un flag è false → il poster non va in carousel.
   * Se assenti → compatibilità: il poster resta eleggibile (backend legacy).
   */
  approved?: boolean | null;
  active?: boolean | null;
  isActive?: boolean | null;
  posterApproved?: boolean | null;
  posterActive?: boolean | null;
  activityApproved?: boolean | null;
  businessApproved?: boolean | null;
  /** Piano listing attività collegata al poster (`kiosk_businesses.listing_tier`) — carosello home solo premium lato client. */
  listing_tier?: string | null;
  listingTier?: string | null;
  isPremium?: boolean | null;
  multi_home_posters?: boolean | number | null;
  multiHomePosters?: boolean | number | null;
  uploaded_by_type?: 'admin' | 'business' | string | null;
  uploaded_by_email?: string | null;
  uploadedBy?: string | null;
  /** Route Angular interna (deprecata per tap poster: si usa solo slug → dettaglio attività) */
  internalRoute?: string | null;
  /**
   * Eventuali URL esterni dal backend: sulla home kiosk vengono ignorati (policy 🔒).
   * Non devono mai aprire il browser.
   */
  externalUrl?: string | null;
  linkUrl?: string | null;
  /** Oggetto annidato opzionale: { approved, active, image_url, … } */
  poster?: {
    approved?: boolean | null;
    active?: boolean | null;
    image_url?: string | null;
    imageUrl?: string | null;
  } | null;
}

export interface KioskIdleFullscreenConfig {
  enabled: boolean;
  timeoutMs: number;
  rotationMs: number;
  maintenanceNotes?: string;
}
