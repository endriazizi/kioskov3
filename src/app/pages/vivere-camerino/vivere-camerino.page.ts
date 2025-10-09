import { Component, OnInit, inject } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Router } from '@angular/router';

import {
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon, IonContent
} from '@ionic/angular/standalone';
import { isPlatform, NavController } from '@ionic/angular';
import { CommonModule } from '@angular/common';

import { addIcons } from 'ionicons';
import { arrowBackOutline } from 'ionicons/icons';

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

  isBrowser = true;          // true = PWA/desktop browser, false = app ibrida
  safeUrl!: SafeResourceUrl; // URL sanitizzato per l'iframe

  constructor() {
    addIcons({ arrowBackOutline });
    // considera "ibrido" se gira dentro Capacitor/Cordova
    this.isBrowser = !(isPlatform('hybrid') || isPlatform('capacitor') || isPlatform('cordova'));
  }

  ngOnInit(): void {
    this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.RAW_URL);
  }

  goBack() {
    // torna indietro nello stack (oppure usa navigateRoot('/app/tabs/...') se preferisci)
    this.nav.back();
  }
}
