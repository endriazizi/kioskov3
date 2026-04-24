import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, map, of } from 'rxjs';
import { Location } from '../interfaces/conference.interfaces';
import { ConferenceService } from './conference.service';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class LocationService {
  private http = inject(HttpClient);
  private conference = inject(ConferenceService);

  private locationsSubject = new BehaviorSubject<Location[]>([]);
  public readonly locations$ = this.locationsSubject.asObservable();

  loadLocations(): Observable<Location[]> {
    if (environment.useKioskPublicApi) {
      return this.conference.load().pipe(
        map((data) => {
          const raw = data.map || [];
          const locations: Location[] = raw.map((loc, index: number) => ({
            id: index + 1,
            name: loc.name,
            lat: loc.lat,
            lng: loc.lng,
            center: loc.center,
            icon: loc.icon || '',
            slug: loc.slug,
          }));
          this.locationsSubject.next(locations);
          return locations;
        }),
        catchError((error) => {
          console.error('Error loading locations from API:', error);
          const defaultLocations = [this.fallbackCenter()];
          this.locationsSubject.next(defaultLocations);
          return of(defaultLocations);
        })
      );
    }

    return this.http.get<any>('assets/data/data.json').pipe(
      map(data => {
        if (data.map && Array.isArray(data.map)) {
          // Add IDs to locations
          const locations = data.map.map((location: any, index: number) => ({
            ...location,
            id: index + 1
          }));
          this.locationsSubject.next(locations);
          return locations;
        } else {
          throw new Error('Invalid data format: map array not found');
        }
      }),
      catchError(error => {
        console.error('Error loading locations:', error);
        // Set default locations if data cannot be loaded
        const defaultLocations = [this.fallbackCenter()];
        this.locationsSubject.next(defaultLocations);
        return of(defaultLocations);
      })
    );
  }

  getLocations(): Observable<Location[]> {
    return this.locations$;
  }

  getCenterLocation(): Observable<Location | undefined> {
    return this.locations$.pipe(
      map(locations => locations.find(location => location.center))
    );
  }

  private fallbackCenter(): Location {
    return {
      id: 1,
      name: 'Piazza Dante Castelraimondo',
      lat: 43.20751529831467,
      lng: 13.056397110815189,
      icon: '',
      center: true,
    };
  }
}
