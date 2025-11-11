import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonGrid, IonRow, IonCol,
  IonButton, IonIcon, IonLabel, IonList, IonItem, IonNote, IonText, IonContent
} from '@ionic/angular/standalone';
import { RouterLink } from '@angular/router';
import { addIcons } from 'ionicons';
import { imagesOutline } from 'ionicons/icons';
import { GC_DEFAULT_CONTENT, type GcContent } from './gelateria-centrale.content';

@Component({
  selector: 'app-gelateria-centrale',
  standalone: true,
  templateUrl: './gelateria-centrale.component.html',
  styleUrls: ['./gelateria-centrale.component.scss'],
  imports: [
    CommonModule,
    RouterLink,
    IonContent,
    IonCard, IonCardHeader, IonCardTitle, IonCardContent,
    IonGrid, IonRow, IonCol,
    IonButton, IonIcon, IonLabel, IonList, IonItem, IonNote, IonText
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

  constructor() {
    addIcons({ imagesOutline });
  }

  get c(): GcContent {
    return { ...GC_DEFAULT_CONTENT, ...(this.content || {}) };
  }

  scrollTo(id: string): void {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  trackByIndex = (i: number) => i;
}
