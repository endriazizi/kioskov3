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
  selector: 'page-vivere-camerino',
  templateUrl: './vivere-camerino.page.html',
  styleUrls: ['./vivere-camerino.page.scss'],
  imports: [
    CommonModule,
    IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon, IonContent
  ],
})
export class VivereCamerinoPage implements OnInit {
  private sanitizer = inject(DomSanitizer);
  private nav = inject(NavController);
  private router = inject(Router);

  // URL del sito Vivere Camerino
  private readonly RAW_URL = 'https://www.viverecamerino.it';

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
    // torna indietro nello stack (oppure usa navigateRoot('/app/tabs/...') se preferisci)
    this.nav.back();
  }
}
