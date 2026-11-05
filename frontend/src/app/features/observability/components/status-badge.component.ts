import { ChangeDetectionStrategy, Component, Input } from "@angular/core";
import { STATUS, TaskStatus } from "../models/observability.models";
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "app-status-badge",
  standalone: true,
  template: `<span class="status-badge" [attr.data-status]="status"
    ><span aria-hidden="true">{{ labels[status].icon }}</span
    >{{ labels[status].label }}</span
  >`,
})
export class StatusBadgeComponent {
  @Input({ required: true }) status!: TaskStatus;
  readonly labels = STATUS;
}
