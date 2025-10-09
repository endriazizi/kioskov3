import { Component, OnInit } from '@angular/core';
import { NgIf } from '@angular/common';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonIcon,
} from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

declare var cordova: any;

@Component({
  selector: 'app-turismo',
  standalone: true,
  templateUrl: './turismo.page.html',
  styleUrls: ['./turismo.page.scss'],
  imports: [
    NgIf,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonIcon,
  ],
})
export class TurismoPage implements OnInit {
  readonly url = 'https://castelraimondoturismo.it';
  readonly whitelist = [
    'https://castelraimondoturismo.it',
    'https://www.castelraimondoturismo.it',
    'http://localhost:8100'
  ];

  isBrowser = false;
  safeUrl: SafeResourceUrl | null = null;
  private ref: any;

  constructor(private router: Router, private sanitizer: DomSanitizer) {}

  ngOnInit() {
    // Browser/PWA → iframe con URL "sanitized"
    if (!(window as any).cordova) {
      this.isBrowser = true;
      this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.url);
      return;
    }

    // Device (Cordova/Capacitor) → ThemeableBrowser con filtro whitelist
    try {
      this.ref = cordova?.ThemeableBrowser?.open(
        this.url,
        '_blank',
        {
          toolbar: { height: 50, color: '#222222' },
          closeButton: {
            wwwImage: 'assets/icon/close.png',
            align: 'left',
            event: 'closePressed',
          },
        }
      );

      // Chiusura con bottone
      this.ref?.addEventListener?.('closePressed', () => this.ref?.close?.());

      // Controllo link (whitelist)
      this.ref?.addEventListener?.('loadstart', (event: any) => {
        const url = event.url;
        const allowed = this.whitelist.some(domain => url.startsWith(domain));
        if (!allowed) {
          console.warn('Blocked external URL:', url);
          this.ref.stop();
          this.ref.executeScript({ code: "alert('Navigazione non consentita');" });
        }
      });
    } catch (e) {
      // Fallback: se ThemeableBrowser non è disponibile
      window.open(this.url, '_system');
    }
  }

  goBack() {
    this.ref?.close?.();
    this.router.navigate(['/app/tabs/speakers']);
  }
}
