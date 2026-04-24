import { Component, inject, signal } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { Title } from "@angular/platform-browser";
import { RouterLink } from "@angular/router";
import { NgIf } from "@angular/common";
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonInput,
  IonTextarea,
  IonItem,
  IonLabel,
  IonNote,
  IonSpinner,
  IonButtons,
  IonIcon,
} from "@ionic/angular/standalone";
import { ToastController } from "@ionic/angular";
import { addIcons } from "ionicons";
import { arrowBackOutline } from "ionicons/icons";
import { firstValueFrom } from "rxjs";
import { KioskApiService } from "../../providers/kiosk-api.service";

@Component({
  standalone: true,
  selector: "app-piani-premium-page",
  templateUrl: "./piani-premium.page.html",
  styleUrl: "./piani-premium.page.scss",
  imports: [
    NgIf,
    ReactiveFormsModule,
    RouterLink,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButton,
    IonInput,
    IonTextarea,
    IonItem,
    IonLabel,
    IonNote,
    IonSpinner,
    IonButtons,
    IonIcon,
  ],
})
export class PianiPremiumPage {
  private fb = inject(FormBuilder);
  private toast = inject(ToastController);
  private title = inject(Title);
  private kioskApi = inject(KioskApiService);

  readonly submitting = signal(false);
  readonly sent = signal(false);
  readonly year = new Date().getFullYear();

  form = this.fb.nonNullable.group({
    name: ["", [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    email: ["", [Validators.required, Validators.email, Validators.maxLength(190)]],
    phone: ["", [Validators.maxLength(40)]],
    organization: ["", [Validators.maxLength(160)]],
    message: ["", [Validators.maxLength(4000)]],
    website: [""],
  });

  constructor() {
    addIcons({ arrowBackOutline });
    this.title.setTitle("Piani Kiosk - Base e Premium");
  }

  scrollToForm(): void {
    document.getElementById("richiesta")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async submit(): Promise<void> {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    const body = this.form.getRawValue();
    try {
      await firstValueFrom(this.kioskApi.submitPremiumRequest(body));
      this.sent.set(true);
      this.form.reset({ name: "", email: "", phone: "", organization: "", message: "", website: "" });
      const t = await this.toast.create({
        message: "Richiesta inviata. Ti contatteremo al piu' presto.",
        duration: 3500,
        color: "success",
        position: "bottom",
      });
      await t.present();
    } catch {
      const t = await this.toast.create({
        message:
          "Invio non riuscito. Verifica la connessione o riprova piu' tardi. Se il problema persiste, scrivi a endri.azizi@gmail.com",
        duration: 6000,
        color: "danger",
        position: "bottom",
      });
      await t.present();
    } finally {
      this.submitting.set(false);
    }
  }
}
