import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgFor, NgIf } from '@angular/common';
import {
  IonAvatar,
  IonBadge,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonChip,
  IonCol,
  IonContent,
  IonGrid,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonMenuButton,
  IonRow,
  IonSearchbar,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { filterOutline, storefrontOutline } from 'ionicons/icons';
import { Speaker } from '../../interfaces/conference.interfaces';
import { ConferenceService } from '../../providers/conference.service';
import { KioskApiService } from '../../providers/kiosk-api.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'page-speaker-list',
  templateUrl: 'speaker-list.html',
  styleUrls: ['./speaker-list.scss'],
  imports: [
    NgFor,
    NgIf,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonMenuButton,
    IonTitle,
    IonContent,
    IonGrid,
    IonRow,
    IonCol,
    IonCard,
    IonCardContent,
    IonAvatar,
    IonLabel,
    IonSearchbar,
    IonChip,
    IonBadge,
    IonButton,
    IonIcon,
    RouterLink,
  ],
})
export class SpeakerListPage {
  private confData = inject(ConferenceService);
  private kioskApi = inject(KioskApiService);

  allSpeakers: Speaker[] = [];
  filteredSpeakers: Speaker[] = [];
  searchText = '';
  /** null = tutte */
  categoryFilter: string | null = null;
  categories: string[] = [];

  constructor() {
    addIcons({ filterOutline, storefrontOutline });
  }

  ionViewDidEnter() {
    this.confData.getSpeakers().subscribe((speakers) => {
      this.allSpeakers = speakers
        .filter((s) => s.showInPoi !== false)
        .sort((a, b) =>
        a.name.localeCompare(b.name, 'it', { sensitivity: 'base' })
      );
      this.syncCategoriesFromList();
      this.applyFilter();
    });
    if (environment.useKioskPublicApi) {
      this.kioskApi.getBusinessCategories().subscribe({
        next: (raw) => {
          const items = (raw as { items?: string[] })?.items ?? [];
          this.mergeCategories(items);
        },
        error: () => {},
      });
    }
  }

  private syncCategoriesFromList() {
    const fromList = [
      ...new Set(
        this.allSpeakers.map((s) => (s.category || '').trim()).filter(Boolean)
      ),
    ];
    this.mergeCategories(fromList);
  }

  private mergeCategories(extra: string[]) {
    const set = new Set([...this.categories, ...extra]);
    this.categories = [...set].sort((a, b) => a.localeCompare(b, 'it'));
  }

  onSearch(ev: CustomEvent) {
    this.searchText = String((ev as any).detail?.value ?? '').trim();
    this.applyFilter();
  }

  setCategory(cat: string | null) {
    this.categoryFilter = cat;
    this.applyFilter();
  }

  clearFilters() {
    this.searchText = '';
    this.categoryFilter = null;
    this.applyFilter();
  }

  applyFilter() {
    const q = this.searchText.toLowerCase().replace(/\s+/g, ' ').trim();
    const words = q ? q.split(' ').filter(Boolean) : [];
    let list = this.allSpeakers;
    if (this.categoryFilter) {
      list = list.filter(
        (s) => (s.category || '').trim() === this.categoryFilter
      );
    }
    if (words.length) {
      list = list.filter((s) => {
        const blob = `${s.name} ${s.description} ${s.category} ${s.address} ${s.location}`
          .toLowerCase()
          .replace(/\s+/g, ' ');
        return words.every((w) => blob.includes(w));
      });
    }
    this.filteredSpeakers = list;
  }

  trackSpeaker(_index: number, s: Speaker) {
    return s.id || s.slug || s.name;
  }

  trackCat(_index: number, c: string) {
    return c;
  }
}
