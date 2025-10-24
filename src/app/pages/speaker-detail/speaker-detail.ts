import { NgOptimizedImage } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Browser } from '@capacitor/browser';
import {
  ActionSheetController,
  IonBackButton,
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonLabel,
  IonToolbar,
  IonText,
  IonItem,
  IonFabButton,
  IonFab,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  callOutline,
  callSharp,
  logoGithub,
  logoInstagram,
  logoTwitter,
  shareOutline,
  shareSharp,
} from 'ionicons/icons';
import { Speaker } from '../../interfaces/conference.interfaces';
import { ConferenceService } from '../../providers/conference.service';

@Component({
  selector: 'page-speaker-detail',
  templateUrl: 'speaker-detail.html',
  styleUrls: ['./speaker-detail.scss'],
  standalone: true,
  imports: [
    IonFab,
    IonFabButton,
    IonItem,
    IonText,
    RouterLink,
    IonContent,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonButton,
    IonIcon,
    IonChip,
    IonLabel,
    NgOptimizedImage,
  ],
  providers: [ActionSheetController],
})
export class SpeakerDetailPage {
  speaker!: Speaker;

  // === SLIDER FOTO: stato pallini ===
  currentSlide = 0;

  private confService = inject(ConferenceService);
  private route = inject(ActivatedRoute);
  private actionSheetCtrl = inject(ActionSheetController);

  constructor() {
    addIcons({
      callOutline,
      callSharp,
      shareOutline,
      shareSharp,
      logoTwitter,
      logoGithub,
      logoInstagram,
    });
  }

  ionViewWillEnter(): void {
    this.confService.load().subscribe((data) => {
      const speakerId = this.route.snapshot.paramMap.get('speakerId');
      if (!speakerId || !data?.speakers) return;
      const found = data.speakers.find((s) => s?.id === speakerId);
      if (found) this.speaker = found;
      // reset indice slider quando entro
      this.currentSlide = 0;
    });
  }

  // Link esterni http/https con Capacitor Browser
  async openExternalUrl(url: string): Promise<void> {
    await Browser.open({ url });
  }

  async openSpeakerShare(speaker: any): Promise<void> {
    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Share ' + speaker.name,
      buttons: [
        {
          text: 'Copy Link',
          handler: () => {
            const anyWindow = window as any;
            if (anyWindow.cordova?.plugins?.clipboard) {
              anyWindow.cordova.plugins.clipboard.copy(
                'https://twitter.com/' + speaker.twitter
              );
            }
          },
        },
        {
          text: 'Share via ...',
        },
        {
          text: 'Cancel',
          role: 'cancel',
        },
      ],
    });

    await actionSheet.present();
  }

  async openContact(speaker: Speaker): Promise<void> {
    const mode = 'ios';

    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Contact ' + speaker.name,
      buttons: [
        {
          text: `Email ( ${speaker.email} )`,
          icon: mode !== 'ios' ? 'mail' : undefined,
          handler: () => {
            void window.open(`mailto:${speaker.email}`, '_self');
          },
        },
        {
          text: `Call ( ${speaker.phone} )`,
          icon: mode !== 'ios' ? 'call' : undefined,
          handler: () => {
            void window.open(`tel:${speaker.phone}`, '_self');
          },
        },
        {
          text: 'Cancel',
          role: 'cancel',
        },
      ],
    });

    await actionSheet.present();
  }

  // === SLIDER FOTO: aggiornamento indice attivo via scroll ===
  onSlidesScroll(container: HTMLElement): void {
    const w = container.clientWidth || 1;
    const idx = Math.round(container.scrollLeft / w);
    if (idx !== this.currentSlide) {
      this.currentSlide = idx;
    }
  }
}
