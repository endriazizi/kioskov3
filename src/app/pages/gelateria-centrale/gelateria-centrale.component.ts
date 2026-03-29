import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonCard, IonCardContent,
  IonGrid, IonRow, IonCol,
  IonButton, IonIcon, IonContent,
  IonModal, IonHeader, IonToolbar, IonButtons, IonTitle,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { closeOutline } from 'ionicons/icons';
import { GC_DEFAULT_CONTENT, type GcContent } from './gelateria-centrale.content';

@Component({
  selector: 'app-gelateria-centrale',
  standalone: true,
  templateUrl: './gelateria-centrale.component.html',
  styleUrls: ['./gelateria-centrale.component.scss'],
  imports: [
    CommonModule,
    IonContent,
    IonCard, IonCardContent,
    IonGrid, IonRow, IonCol,
    IonButton, IonIcon,
    IonModal, IonHeader, IonToolbar, IonButtons, IonTitle,
  ]
})
export class GelateriaCentraleComponent {
  /** clone-style content (overridable) */
  @Input() content?: GcContent;

  /** back-compat inputs usati da SpeakerDetail (evita NG8002) */
  @Input() name: string | null = null;
  @Input() logo: string | null = null;
  @Input() profilePic: string | null = null;
  @Input() address: string | null = null;
  @Input() phone: string | null = null;
  @Input() websiteUrl?: string;

  /** Lightbox immagine a tutto schermo */
  lightboxOpen = false;
  lightboxSrc = '';
  lightboxAlt = '';

  constructor() {
    addIcons({ closeOutline });
  }

  get c(): GcContent {
    return { ...GC_DEFAULT_CONTENT, ...(this.content || {}) };
  }

  scrollTo(id: string): void {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  openImageLightboxFromEvent(ev: Event): void {
    const t = ev.target as HTMLImageElement | null;
    if (!t?.src) return;
    ev.stopPropagation();
    this.openImageLightbox(t.currentSrc || t.src, t.alt || '');
  }

  openImageLightbox(src: string, alt: string): void {
    this.lightboxSrc = src;
    this.lightboxAlt = alt || '';
    this.lightboxOpen = true;
  }

  closeImageLightbox(): void {
    this.lightboxOpen = false;
    this.lightboxSrc = '';
    this.lightboxAlt = '';
  }

  trackByIndex = (i: number) => i;
}
