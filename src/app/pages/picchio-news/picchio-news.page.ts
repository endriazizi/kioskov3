import { Component, OnInit, inject } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Router } from '@angular/router';

import {
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon, IonContent
} from '@ionic/angular/standalone';
import { NavController } from '@ionic/angular';
import { CommonModule } from '@angular/common';

import { addIcons } from 'ionicons';
import { arrowBackOutline } from 'ionicons/icons';
import { kioskEmbedUseInAppFrame } from '../../security/kiosk-embed-page.util';

@Component({
  standalone: true,
  selector: 'page-picchio-news',
  templateUrl: './picchio-news.page.html',
  styleUrls: ['./picchio-news.page.scss'],
  imports: [
    CommonModule,
    IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon, IonContent
  ],
})
export class PicchioNewsPage implements OnInit {
  private sanitizer = inject(DomSanitizer);
  private nav = inject(NavController);
  private router = inject(Router);

  // URL del sito Picchio News
  private readonly RAW_URL = 'https://www.picchionews.it';

  isBrowser = true;
  safeUrl!: SafeResourceUrl;

  constructor() {
    addIcons({ arrowBackOutline });
    this.isBrowser = kioskEmbedUseInAppFrame();
  }

  ngOnInit(): void {
    this.isBrowser = kioskEmbedUseInAppFrame();
    this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.RAW_URL);
  }

  goBack() {
    // torna indietro nello stack (oppure usa navigateRoot('/app/tabs/...') se vuoi una rotta fissa)
    this.nav.back();
  }
}
