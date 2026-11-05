import {
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  signal,
  inject,
} from "@angular/core";
import {
  IsActiveMatchOptions,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from "@angular/router";
import { BackendModeService } from "../backend/backend-mode.service";
import { IconComponent } from "./icon.component";

@Component({
  selector: "app-shell",
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, IconComponent],
  templateUrl: "./shell.component.html",
  styleUrl: "./shell.component.css",
})
export class ShellComponent {
  readonly backend = inject(BackendModeService);
  private readonly router = inject(Router);
  private readonly routeMatch: IsActiveMatchOptions = {
    paths: "exact",
    queryParams: "ignored",
    fragment: "ignored",
    matrixParams: "ignored",
  };
  get pipelinesActive(): boolean {
    return (
      this.router.isActive("/overview", this.routeMatch) ||
      this.router.isActive("/dependencies", this.routeMatch)
    );
  }
  readonly menuOpen = signal(false);
  @ViewChild("menuButton") menuButton?: ElementRef<HTMLButtonElement>;
  @ViewChild("drawer") drawer?: ElementRef<HTMLElement>;

  openMenu(): void {
    this.menuOpen.set(true);
    setTimeout(() =>
      this.drawer?.nativeElement
        .querySelector<HTMLButtonElement>("button")
        ?.focus(),
    );
  }
  closeMenu(): void {
    this.menuOpen.set(false);
    setTimeout(() => this.menuButton?.nativeElement.focus());
  }
  @HostListener("document:keydown", ["$event"])
  handleKey(event: KeyboardEvent): void {
    if (!this.menuOpen()) return;
    if (event.key === "Escape") {
      event.preventDefault();
      this.closeMenu();
    }
    if (event.key !== "Tab") return;
    const elements =
      this.drawer?.nativeElement.querySelectorAll<HTMLElement>(
        "button, a[href]",
      );
    if (!elements?.length) return;
    const first = elements[0];
    const last = elements[elements.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
