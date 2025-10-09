import { Component, OnInit, inject } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Router } from '@angular/router';

import {
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon, IonContent
} from '@ionic/angular/standalone';
import { isPlatform, NavController } from '@ionic/angular';
import { CommonModule } from '@angular/common';

// opzionale: registrazione icone (se usi name="arrow-back-outline")
import { addIcons } from 'ionicons';
import { arrowBackOutline } from 'ionicons/icons';

@Component({
  standalone: true,
  selector: 'page-infiorata',
  templateUrl: './infiorata.page.html',
  styleUrls: ['./infiorata.page.scss'],
  imports: [
    CommonModule,
    IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon, IonContent
  ],
})
export class InfiorataPage implements OnInit {
  private sanitizer = inject(DomSanitizer);
  private nav = inject(NavController);
  private router = inject(Router);

  // URL del sito Infiorata (cambialo se diverso)
  private readonly RAW_URL = 'https://www.infioratacastelraimondo.it';

  isBrowser = true;                 // true = PWA/desktop browser, false = app ibrida
  safeUrl!: SafeResourceUrl;        // URL sanitizzato per l'iframe

  constructor() {
    addIcons({ arrowBackOutline });
    // considera "ibrido" se gira dentro Capacitor/Cordova
    this.isBrowser = !(isPlatform('hybrid') || isPlatform('capacitor') || isPlatform('cordova'));
  }

  ngOnInit(): void {
    this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.RAW_URL);
  }

  goBack() {
    // torna indietro nello stack; se vuoi una rotta specifica, usa navigateRoot('/app/tabs/...').
    this.nav.back();
  }
}
