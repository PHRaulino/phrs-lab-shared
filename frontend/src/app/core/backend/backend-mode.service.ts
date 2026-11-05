import { Injectable, computed, signal } from "@angular/core";
import { BehaviorSubject } from "rxjs";
export type BackendState = "disabled" | "available" | "unavailable";
export { BackendDisabledError } from "./backend-request.guard";
@Injectable({ providedIn: "root" })
export class BackendModeService {
  readonly enabled = signal(this.restore());
  readonly changes = new BehaviorSubject(this.enabled());
  private readonly available = signal(false);
  readonly storageError = signal("");
  readonly state = computed<BackendState>(() =>
    !this.enabled()
      ? "disabled"
      : this.available()
        ? "available"
        : "unavailable",
  );
  readonly label = computed(() =>
    this.state() === "disabled"
      ? "Backend desabilitado"
      : this.state() === "available"
        ? "Backend disponível"
        : "Backend indisponível",
  );
  setEnabled(enabled: boolean): void {
    this.available.set(false);
    this.enabled.set(enabled);
    this.changes.next(enabled);
    try {
      localStorage.setItem("phrs.backend.enabled.v1", JSON.stringify(enabled));
      this.storageError.set("");
    } catch {
      this.storageError.set(
        "A preferência foi aplicada nesta sessão, mas não pôde ser salva no navegador.",
      );
    }
  }
  reportAvailable(available: boolean): void {
    if (this.enabled()) this.available.set(available);
  }
  private restore(): boolean {
    try {
      return localStorage.getItem("phrs.backend.enabled.v1") !== "false";
    } catch {
      return true;
    }
  }
}
