import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import {
  IonIcon,
  IonLabel,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonTabs,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  calendar,
  homeOutline,
  informationCircle,
  location,
  newspaperOutline,
  people,
  pricetagsOutline,
} from 'ionicons/icons';

@Component({
    templateUrl: 'tabs-page.html',
    styleUrls: ['tabs-page.scss'],
    imports: [
        IonTabs,
        IonRouterOutlet,
        IonTabBar,
        IonTabButton,
        IonIcon,
        IonLabel,
        RouterModule,
    ]
})
export class TabsPage {
  constructor() {
    addIcons({
      calendar,
      homeOutline,
      people,
      location,
      informationCircle,
      newspaperOutline,
      pricetagsOutline,
    });
  }
}
