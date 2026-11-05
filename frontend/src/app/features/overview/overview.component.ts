import { Component, DestroyRef, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { RouterLink } from "@angular/router";
import {
  Overview,
  OverviewService,
} from "../../core/services/overview.service";
import { IconComponent } from "../../core/layout/icon.component";

@Component({
  selector: "app-overview",
  standalone: true,
  imports: [RouterLink, IconComponent],
  templateUrl: "./overview.component.html",
  styleUrl: "./overview.component.css",
})
export class OverviewComponent {
  private readonly service = inject(OverviewService);
  private readonly destroyRef = inject(DestroyRef);
  readonly data = signal<Overview | null>(null);
  readonly loading = signal(false);
  readonly error = signal(false);
  constructor() {
    this.load();
  }
  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.service
      .getOverview()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.data.set(data);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        },
      });
  }
}
