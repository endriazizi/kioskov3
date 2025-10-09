import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  ViewChild,
  inject
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  IonButtons,
  IonContent,
  IonHeader,
  IonMenuButton,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import * as L from 'leaflet';
import { firstValueFrom } from 'rxjs';
import { Location } from '../../interfaces/conference.interfaces';
import { LocationService } from '../../providers/location.service';

@Component({
  selector: 'page-map',
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button></ion-menu-button>
        </ion-buttons>
        <ion-title>Map</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div #mapCanvas class="map-canvas"></div>
    </ion-content>
  `,
  styleUrls: ['./map.scss'],
  imports: [
    IonHeader,
    IonToolbar,
    IonButtons,
    IonMenuButton,
    IonTitle,
    IonContent,
  ],
  standalone: true,
})
export class MapPage implements AfterViewInit {
  private locationService = inject(LocationService);
  private destroyRef = inject(DestroyRef);

  private map: L.Map | null = null;
  private markers: L.Marker[] = [];

  @ViewChild('mapCanvas', { static: true }) mapElement!: ElementRef<HTMLDivElement>;

  ngAfterViewInit() {
    // Carica inizialmente le locations e crea la mappa
    this.locationService.loadLocations()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.initializeMap();
      });

    // Re-inizializza se cambia l’elenco locations
    this.locationService.getLocations()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.map) {
          this.initializeMap();
        }
      });

    // Cleanup
    this.destroyRef.onDestroy(() => {
      if (this.map) this.map.remove();
    });
  }

  private async initializeMap() {
    const mapEle = this.mapElement.nativeElement;

    // Pulisci eventuale mappa precedente
    if (this.map) {
      this.map.remove();
      this.markers.forEach(m => m.remove());
      this.markers = [];
    }

    try {
      // Centro mappa
      const centerLocation = await firstValueFrom(this.locationService.getCenterLocation());
      if (!centerLocation) return;

      // 👇 Disattivo il controllo di attribuzione di default (niente link "Leaflet")
      this.map = L.map(mapEle, {
        center: [centerLocation.lat, centerLocation.lng],
        zoom: 16,
        preferCanvas: true,
        attributionControl: false,   // <<< fondamentale
      });

      // Icone default marker
      L.Marker.prototype.options.icon = L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        shadowSize: [41, 41],
        shadowAnchor: [12, 41]
      });

      // Tile layer (attribution testuale, non link)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        // puoi tenere l’attribution anche qui (non sarà un link)
        attribution: '© OpenStreetMap contributors'
      }).addTo(this.map);

      // 👇 Attribution control CUSTOM senza prefix/link "Leaflet"
      L.control.attribution({
        position: 'bottomright',
        prefix: false, // <<< NO "Leaflet"
      })
      .addAttribution('© OpenStreetMap contributors') // testo liscio
      .addTo(this.map);

      // Markers
      const locations = await firstValueFrom(this.locationService.getLocations());
      if (this.map && locations?.length) {
        locations.forEach((location: Location) => {
          const marker = L.marker([location.lat, location.lng])
            .addTo(this.map as L.Map)
            .bindPopup(`${location.name}`, { className: 'location-popup' });
          this.markers.push(marker);
        });
      }

      mapEle.classList.add('show-map');

      // Fix rendering
      setTimeout(() => this.map?.invalidateSize(), 100);
    } catch (err) {
      console.error('Error initializing map:', err);
    }
  }
}
