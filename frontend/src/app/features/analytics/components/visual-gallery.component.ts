import {
  Component,
  EventEmitter,
  Output,
  computed,
  inject,
  signal,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { VISUALS } from "../data/visual-registry";
import { VisualDefinition } from "../models/analytics.models";
import { AnalyticsPolicy } from "../data/analytics-policy.service";
@Component({
  selector: "app-visual-gallery",
  standalone: true,
  imports: [FormsModule],
  templateUrl: "./visual-gallery.component.html",
  styleUrl: "./visual-gallery.component.css",
})
export class VisualGalleryComponent {
  private readonly policy = inject(AnalyticsPolicy);
  @Output() previewed = new EventEmitter<VisualDefinition>();
  @Output() added = new EventEmitter<VisualDefinition>();
  readonly gallerySearch = signal("");
  readonly galleryCategory = signal("");
  readonly galleryTag = signal("");
  readonly categories = [...new Set(VISUALS.map((v) => v.category))];
  readonly tags = [...new Set(VISUALS.flatMap((v) => v.tags))];
  readonly gallery = computed(() =>
    this.policy.internal
      ? VISUALS.filter(
          (v) =>
            (!this.gallerySearch() ||
              `${v.name} ${v.description}`
                .toLocaleLowerCase()
                .includes(this.gallerySearch().toLocaleLowerCase())) &&
            (!this.galleryCategory() ||
              v.category === this.galleryCategory()) &&
            (!this.galleryTag() || v.tags.includes(this.galleryTag())),
        )
      : [],
  );
}
