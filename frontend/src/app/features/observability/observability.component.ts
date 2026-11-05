import { Component, inject, signal } from "@angular/core";
import { DatePipe } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, RouterLink, RouterLinkActive } from "@angular/router";
import { ObservabilityStore } from "./state/observability.store";
import { FiltersComponent } from "./components/filters.component";
import { HierarchyComponent } from "./components/hierarchy.component";
import { TaskDetailComponent } from "./components/task-detail.component";
import { TaskGraphComponent } from "./graph/task-graph.component";
import { STATUS, Task } from "./models/observability.models";
import { TaskEditorComponent } from "./components/task-editor.component";
import { StatusBadgeComponent } from "./components/status-badge.component";

@Component({
  selector: "app-observability",
  standalone: true,
  providers: [ObservabilityStore],
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    RouterLinkActive,
    FiltersComponent,
    HierarchyComponent,
    TaskDetailComponent,
    TaskGraphComponent,
    StatusBadgeComponent,
    TaskEditorComponent,
  ],
  templateUrl: "./observability.component.html",
  styleUrl: "./observability.component.css",
})
export class ObservabilityComponent {
  readonly graphMode =
    inject(ActivatedRoute).snapshot.data["graphMode"] === true;
  readonly store = inject(ObservabilityStore);
  readonly editingTask = signal<Task | null>(null);
  openEditor(id: string): void {
    const task = this.store.tasks().find((item) => item.id === id);
    if (task) {
      this.editingTask.set(task);
    }
  }
  readonly treeOpen = signal(true);
  readonly statusLabels = STATUS;
  readonly legend = Object.entries(STATUS).map(([key, value]) => ({
    key,
    ...value,
  }));
  toggleWave(key: string): void {
    this.store.selectedId.set(null);
    this.store.selectedWave.update((current) => (current === key ? null : key));
  }
}
