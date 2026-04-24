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
    });
  }

  onTabTap(tab: string, event: Event): void {
    const target = event.target as HTMLElement | null;
    // #region agent log
    fetch('http://127.0.0.1:7727/ingest/c4e926a9-a777-4a16-97cd-643defec2cb0',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'378a0a'},body:JSON.stringify({sessionId:'378a0a',runId:'pre-fix',hypothesisId:'H7',location:'tabs-page.ts:onTabTap',message:'Tab button click handler fired',data:{tab,targetTag:target?.tagName ?? null,targetClass:target?.className ?? null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  }
}
