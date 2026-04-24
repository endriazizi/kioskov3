export interface Speaker {
  name: string;
  logo: string;
  profilePic: string;
  instagram: string;
  twitter: string;
  about: string;
  /** Tagline breve (solo alcuni speaker in data.json) */
  about_1?: string;
  title: string;
  location: string;
  email: string;
  phone: string;
  sito:  string;
  /** legacy / JSON locale: può essere stringa o elenco path */
  foto: string | string[];

  category: string;
  description: string;
  address: string;
  openingHours: string;
  id: string;
  /** Slug API / portale business — allineato a enea_be kiosk_businesses.slug */
  slug?: string;
  sessions?: Session[];
  /** Copertina hero (API kiosk) */
  coverUrl?: string;
  /** Galleria immagini (API kiosk) */
  gallery?: string[];
  /** Coordinate mappa (API kiosk / DB) */
  lat?: number;
  lng?: number;
  /** Piano listing (API: free / premium) */
  listingTier?: string;
  isPremium?: boolean;
  /** Immagine carosello home (JSON locale); priorità su foto/gallery */
  posterUrl?: string;
  /** Icona marker mappa (API: approvata da admin) */
  mapMarkerUrl?: string;
  showInPoi?: boolean;
  showInMap?: boolean;
  showInHome?: boolean;
}

export interface Session {
  hide?: boolean;
  name: string;
  location: string;
  description?: string;
  speakerNames: string[];
  timeStart: string;
  timeEnd: string;
  tracks: string[];
  id: string;
  speakers?: Speaker[];
  /** Locandina (URL risolto) — eventi comunali da API */
  posterUrl?: string;
  eventDateIso?: string;
  eventDateEndIso?: string;
}

export interface Group {
  time: string;
  sessions: Session[];
  hide?: boolean;
}

export interface ScheduleDay {
  date: string;
  groups: Group[];
  shownSessions?: number;
}

export interface Track {
  name: string;
  icon: string;
}

export interface MapLocation {
  id?: number;
  name: string;
  lat: number;
  lng: number;
  center?: boolean;
  icon?: string;
  slug?: string;
}

export interface ConferenceData {
  schedule: ScheduleDay[];
  speakers: Speaker[];
  tracks: Track[];
  map: MapLocation[];
}

export interface Location {
  id: number;
  name: string;
  lat: number;
  lng: number;
  center?: boolean;
  /** URL logo marker (Leaflet divIcon) */
  icon?: string;
  /** Slug per popup → dettaglio */
  slug?: string;
}
