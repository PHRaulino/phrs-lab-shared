import {
  ChangeDetectionStrategy,
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  Output,
  ViewChild,
  computed,
  signal,
} from "@angular/core";
import { STATUS, Task } from "../models/observability.models";
import { layoutGraph } from "./graph-layout";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "app-task-graph",
  standalone: true,
  templateUrl: "./task-graph.component.html",
  styleUrl: "./task-graph.component.css",
})
export class TaskGraphComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() tasks: Task[] = [];
  @Input() selectedId: string | null = null;
  @Input() selectedWave: string | null = null;
  @Input() focusRequest: { id: string; revision: number } | null = null;
  @Output() selected = new EventEmitter<string>();
  @ViewChild("viewport") viewport?: ElementRef<HTMLElement>;
  readonly model = signal(layoutGraph([]));
  readonly scale = signal(1);
  readonly pan = signal({ x: 0, y: 0 });
  readonly dragging = signal(false);
  readonly transform = computed(
    () => `translate(${this.pan().x} ${this.pan().y}) scale(${this.scale()})`,
  );
  readonly labels = STATUS;
  upstream = new Set<string>();
  downstream = new Set<string>();
  private observer?: ResizeObserver;
  private lastPoint: { x: number; y: number } | null = null;
  private identity = "";
  ngOnChanges(changes: SimpleChanges): void {
    const identity = this.tasks.map((t) => t.id).join("|");
    if (changes["tasks"]) this.model.set(layoutGraph(this.tasks));
    const current = this.tasks.find((t) => t.id === this.selectedId);
    this.upstream = new Set(current?.dependencies ?? []);
    this.downstream = new Set(
      this.tasks
        .filter((t) => t.dependencies.includes(this.selectedId ?? ""))
        .map((t) => t.id),
    );
    if (identity !== this.identity) {
      this.identity = identity;
      this.fit();
    }
    if (changes["focusRequest"] && this.focusRequest)
      this.center(this.focusRequest.id);
  }
  ngAfterViewInit(): void {
    this.observer = new ResizeObserver(() => {
      if (this.selectedId) this.center(this.selectedId);
      else this.fit();
    });
    if (this.viewport) this.observer.observe(this.viewport.nativeElement);
    queueMicrotask(() => this.fit());
  }
  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
  fit(): void {
    const rect = this.viewport?.nativeElement.getBoundingClientRect();
    if (!rect?.width || !rect.height) return;
    const model = this.model();
    const scale = Math.min(
      1.15,
      Math.max(
        0.02,
        Math.min(
          (rect.width - 32) / model.width,
          (rect.height - 50) / model.height,
        ),
      ),
    );
    this.scale.set(scale);
    this.pan.set({
      x: (rect.width - model.width * scale) / 2,
      y: (rect.height - model.height * scale) / 2,
    });
  }
  center(id: string): void {
    const node = this.model().nodes.find((n) => n.task.id === id);
    const rect = this.viewport?.nativeElement.getBoundingClientRect();
    if (!node || !rect) return;
    const scale = Math.max(0.85, this.scale());
    this.scale.set(scale);
    this.pan.set({
      x: rect.width / 2 - (node.x + 102) * scale,
      y: rect.height / 2 - (node.y + 38) * scale,
    });
  }
  zoom(factor: number, point?: { x: number; y: number }): void {
    const rect = this.viewport?.nativeElement.getBoundingClientRect();
    if (!rect) return;
    const anchor = point ?? { x: rect.width / 2, y: rect.height / 2 };
    const old = this.scale(),
      next = Math.max(0.02, Math.min(2, old * factor));
    const pan = this.pan();
    this.pan.set({
      x: anchor.x - ((anchor.x - pan.x) * next) / old,
      y: anchor.y - ((anchor.y - pan.y) * next) / old,
    });
    this.scale.set(next);
  }
  wheel(event: WheelEvent): void {
    event.preventDefault();
    const rect = this.viewport!.nativeElement.getBoundingClientRect();
    this.zoom(event.deltaY < 0 ? 1.12 : 1 / 1.12, {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  }
  pointerDown(event: PointerEvent): void {
    if (event.button !== 0 || (event.target as Element).closest("[data-task]"))
      return;
    (event.currentTarget as SVGElement).setPointerCapture(event.pointerId);
    this.lastPoint = { x: event.clientX, y: event.clientY };
    this.dragging.set(true);
  }
  pointerMove(event: PointerEvent): void {
    if (!this.lastPoint) return;
    const point = this.lastPoint;
    this.pan.update((p) => ({
      x: p.x + event.clientX - point.x,
      y: p.y + event.clientY - point.y,
    }));
    this.lastPoint = { x: event.clientX, y: event.clientY };
  }
  pointerUp(): void {
    this.lastPoint = null;
    this.dragging.set(false);
  }
  keydown(event: KeyboardEvent): void {
    if ((event.target as Element).closest("[data-task]")) return;
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      this.zoom(1.2);
    } else if (event.key === "-") {
      event.preventDefault();
      this.zoom(1 / 1.2);
    } else if (event.key === "Home") {
      event.preventDefault();
      this.fit();
    } else if (
      ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
    ) {
      event.preventDefault();
      this.pan.update((p) => ({
        x:
          p.x +
          (event.key === "ArrowLeft"
            ? 40
            : event.key === "ArrowRight"
              ? -40
              : 0),
        y:
          p.y +
          (event.key === "ArrowUp" ? 40 : event.key === "ArrowDown" ? -40 : 0),
      }));
    }
  }
  related(id: string): boolean {
    return (
      id === this.selectedId || this.upstream.has(id) || this.downstream.has(id)
    );
  }
  muted(task: Task): boolean {
    return (
      (!!this.selectedId && !this.related(task.id)) ||
      (!!this.selectedWave &&
        `${task.workflowId}:${task.wave}` !== this.selectedWave)
    );
  }
  edgeHighlight(from: string, to: string): boolean {
    return from === this.selectedId || to === this.selectedId;
  }
  selectKey(event: KeyboardEvent, id: string): void {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      this.selected.emit(id);
    }
  }
}
