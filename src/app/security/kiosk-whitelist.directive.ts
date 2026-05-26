import { Directive, OnDestroy, OnInit, inject } from '@angular/core';
import { ToastController } from '@ionic/angular';

import { installKioskOutboundGuard, uninstallKioskOutboundGuard } from './kiosk-outbound-guard';
import { KioskWhitelistService } from './kiosk-whitelist.service';

/**
 * Attiva il blocco link/uscite esterne sul totem.
 * L’installazione effettiva è in `kiosk-outbound-guard` (anche via APP_INITIALIZER in main.ts).
 */
@Directive({
  selector: '[appKioskWhitelist]',
  standalone: true,
})
export class KioskWhitelistDirective implements OnInit, OnDestroy {
  private readonly whitelist = inject(KioskWhitelistService);
  private readonly toast = inject(ToastController);

  ngOnInit() {
    installKioskOutboundGuard(this.whitelist, () => {
      void this.blockToast();
    });
  }

  ngOnDestroy() {
    uninstallKioskOutboundGuard();
  }

  private async blockToast() {
    const t = await this.toast.create({
      message: 'Link non consentito in modalità kiosk.',
      duration: 2000,
      position: 'bottom',
    });
    await t.present();
  }
}
