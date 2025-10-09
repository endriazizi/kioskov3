export interface Speaker {
  name: string;
  logo: string;
  profilePic: string;
  instagram: string;
  twitter: string;
  about: string;
  title: string;
  location: string;
  email: string;
  phone: string;
  sito:  string;

  category: string;
  description: string;
  address: string;
  openingHours: string
  id: string;
  sessions?: Session[];
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
  name: string;
  lat: number;
  lng: number;
  center?: boolean;   
  icon?: string;     
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
  icon?: string;      
}
