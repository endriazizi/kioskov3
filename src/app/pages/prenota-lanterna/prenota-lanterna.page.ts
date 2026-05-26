import { Component, OnInit, inject } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Router } from '@angular/router';

import {
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon, IonContent
} from '@ionic/angular/standalone';
import { NavController } from '@ionic/angular';
import { CommonModule } from '@angular/common';

import { addIcons } from 'ionicons';
import { arrowBackOutline, pricetagsOutline } from 'ionicons/icons';
import { kioskEmbedUseInAppFrame } from '../../security/kiosk-embed-page.util';

@Component({
  standalone: true,
  selector: 'page-prenota-lanterna',
  templateUrl: './prenota-lanterna.page.html',
  styleUrls: ['./prenota-lanterna.page.scss'],
  imports: [
    CommonModule,
    IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon, IonContent
  ],
})
export class PrenotaLanternaPage implements OnInit {
  private sanitizer = inject(DomSanitizer);
  private nav = inject(NavController);
  private router = inject(Router);

  // URL del sito Prenota La Lanterna
  // private readonly RAW_URL = 'https://prenota.pizzerialalanterna.it/asporto';
  private readonly RAW_URL = 'https://pizzerialalanterna.it';
  private readonly PREMIUM_PLANS_ROUTE = '/kiosk/piani-premium';

  isBrowser = true;
  safeUrl!: SafeResourceUrl;

  constructor() {
    addIcons({ arrowBackOutline, pricetagsOutline });
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

  openPremiumPlans() {
    this.router.navigateByUrl(this.PREMIUM_PLANS_ROUTE);
  }
}
