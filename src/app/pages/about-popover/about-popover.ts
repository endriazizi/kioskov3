import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { KioskWhitelistService } from '../../security/kiosk-whitelist.service';
import {
  IonItem,
  IonLabel,
  IonList,
  PopoverController,
} from '@ionic/angular/standalone';

@Component({
    template: `
    <ion-list>
      <ion-item
        button
        (click)="close('https://ionicframework.com/getting-started')"
      >
        <ion-label>Learn Ionic</ion-label>
      </ion-item>
      <ion-item button (click)="close('https://ionicframework.com/docs/')">
        <ion-label>Documentation</ion-label>
      </ion-item>
      <ion-item button (click)="close('https://showcase.ionicframework.com')">
        <ion-label>Showcase</ion-label>
      </ion-item>
      <ion-item button (click)="close('https://github.com/ionic-team/ionic')">
        <ion-label>GitHub Repo</ion-label>
      </ion-item>
      <ion-item button (click)="support()">
        <ion-label>Support</ion-label>
      </ion-item>
    </ion-list>
  `,
    imports: [IonList, IonItem, IonLabel],
    providers: [PopoverController]
})
export class PopoverPage {
  private router = inject(Router);
  private popoverCtrl = inject(PopoverController);
  private whitelist = inject(KioskWhitelistService);

  support() {
    this.router.navigate(['/support']);
    this.popoverCtrl.dismiss();
  }

  close(url: string) {
    if (!this.whitelist.isAllowed(url)) {
      this.whitelist.logBlockedExternal(url, 'about-popover');
      this.popoverCtrl.dismiss();
      return;
    }
    window.open(url, '_blank');
    this.popoverCtrl.dismiss();
  }
}
