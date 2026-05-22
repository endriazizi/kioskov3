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
import { Router } from '@angular/router';
import { Location } from '../../interfaces/conference.interfaces';
import { LocationService } from '../../providers/location.service';
import { KioskApiService } from '../../providers/kiosk-api.service';

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
  private kioskApi = inject(KioskApiService);
  private router = inject(Router);
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
        zoom: 17,
        minZoom: 12,
        maxZoom: 19,
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
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors',
      }).addTo(this.map);

      // 👇 Attribution control CUSTOM senza prefix/link "Leaflet"
      L.control.attribution({
        position: 'bottomright',
        prefix: false, // <<< NO "Leaflet"
      })
      .addAttribution('© OpenStreetMap contributors') // testo liscio
      .addTo(this.map);

      this.map.on('popupopen', (ev: L.PopupEvent) => {
        const btn = ev.popup
          .getElement()
          ?.querySelector<HTMLButtonElement>('[data-kiosk-route]');
        if (!btn) return;
        const route = btn.getAttribute('data-kiosk-route');
        btn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (route) void this.router.navigateByUrl(route);
        };
      });

      const locations = await firstValueFrom(this.locationService.getLocations());
      if (this.map && locations?.length) {
        locations.forEach((location: Location) => {
          const icon = this.buildMarkerIcon(location);
          const marker = L.marker([location.lat, location.lng], { icon })
            .addTo(this.map as L.Map)
            .bindPopup(this.popupHtml(location), { className: 'kiosk-map-popup' });
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

  private escapeHtml(s: string): string {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private popupHtml(loc: Location): string {
    const name = this.escapeHtml(loc.name);
    const slug = (loc.slug || '').trim();
    const detail =
      slug &&
      `/app/tabs/speakers/speaker-details/${encodeURIComponent(slug)}`;
    const link = detail
      ? `<button type="button" class="kiosk-map-popup__link" data-kiosk-route="${this.escapeHtml(detail)}">Apri scheda</button>`
      : '';
    return `<div class="kiosk-map-popup__inner"><strong>${name}</strong>${link ? `<br/>${link}` : ''}</div>`;
  }

  private buildMarkerIcon(loc: Location): L.DivIcon {
    const url = loc.icon ? this.kioskApi.resolveAssetUrl(loc.icon) : '';
    const html = url
      ? `<div class="kiosk-map-pin"><img src="${this.escapeHtml(url)}" alt="" referrerpolicy="no-referrer" /></div>`
      : `<div class="kiosk-map-pin kiosk-map-pin--fallback"></div>`;
    return L.divIcon({
      html,
      className: 'kiosk-map-divicon',
      iconSize: [56, 56],
      iconAnchor: [28, 56],
      popupAnchor: [0, -50],
    });
  }
}
