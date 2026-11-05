import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  computed,
  signal,
} from "@angular/core";
import { Task } from "../models/observability.models";
import { StatusBadgeComponent } from "./status-badge.component";
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "app-task-hierarchy",
  standalone: true,
  imports: [StatusBadgeComponent],
  templateUrl: "./hierarchy.component.html",
  styleUrl: "./hierarchy.component.css",
})
export class HierarchyComponent {
  private readonly items = signal<Task[]>([]);
  @Input() set tasks(value: Task[]) {
    this.items.set(value);
  }
  get tasks(): Task[] {
    return this.items();
  }
  @Input() selectedId: string | null = null;
  @Output() selected = new EventEmitter<string>();
  @Output() editRequested = new EventEmitter<string>();
  @Output() collapsed = new EventEmitter<void>();
  readonly tree = computed(() =>
    [...new Set(this.items().map((t) => t.businessUnit))].sort().map((name) => {
      const tasks = this.items().filter((t) => t.businessUnit === name);
      return {
        name,
        count: tasks.length,
        layers: [...new Set(tasks.map((t) => t.layer))].map((layer) => {
          const members = tasks.filter((t) => t.layer === layer);
          return {
            name: layer,
            count: members.length,
            tables: [...new Set(members.map((t) => t.table))].map((table) => ({
              name: table,
              label: table.split(".").pop() || table,
              namespace: table.includes(".")
                ? table.slice(0, table.lastIndexOf("."))
                : "",
              tasks: members.filter((t) => t.table === table),
            })),
          };
        }),
      };
    }),
  );
}
