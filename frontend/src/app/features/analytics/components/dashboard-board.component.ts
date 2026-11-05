import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  signal,
} from "@angular/core";
import {
  BoundFilter,
  DashboardSection,
  FilterValue,
  GridPosition,
  ModuleInstance,
  VisualDefinition,
} from "../models/analytics.models";
import { VisualHostComponent } from "./visual-host.component";
@Component({
  selector: "app-dashboard-board",
  standalone: true,
  imports: [VisualHostComponent],
  templateUrl: "./dashboard-board.component.html",
  styleUrl: "./dashboard-board.component.css",
})
export class DashboardBoardComponent {
  @Input({ required: true }) section!: DashboardSection;
  @Input() registry: VisualDefinition[] = [];
  @Input() filters: BoundFilter[] = [];
  @Input() values: Record<string, FilterValue> = {};
  @Input() editing = false;
  @Input() official = false;
  @Input() highlightedIds: string[] | null = null;
  @Output() action = new EventEmitter<{
    action: string;
    module: ModuleInstance;
  }>();
  @Output() layoutChanged = new EventEmitter<{
    id: string;
    position: GridPosition;
  }>();
  readonly Math = Math;
  readonly menu = signal<string | null>(null);
  readonly resizePreview = signal<{
    id: string;
    position: GridPosition;
  } | null>(null);
  private resize?: {
    id: string;
    startX: number;
    startY: number;
    cell: number;
    initial: GridPosition;
  };
  visual(module: ModuleInstance): VisualDefinition | undefined {
    return this.registry.find((v) => v.id === module.visualId);
  }
  position(module: ModuleInstance): GridPosition {
    return this.resizePreview()?.id === module.id
      ? this.resizePreview()!.position
      : module.layout;
  }
  get rows(): number {
    return Math.max(
      2,
      ...this.section.modules.map((m) => m.layout.y + m.layout.h),
    );
  }
  openMenu(event: Event, id: string): void {
    event.preventDefault();
    this.menu.set(this.menu() === id ? null : id);
  }
  execute(action: string, module: ModuleInstance): void {
    this.menu.set(null);
    this.action.emit({ action, module });
  }
  drag(event: DragEvent, module: ModuleInstance): void {
    if (!this.editing) return;
    event.dataTransfer?.setData("text/plain", module.id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
  }
  dragover(event: DragEvent): void {
    if (this.editing) event.preventDefault();
  }
  drop(event: DragEvent): void {
    if (!this.editing) return;
    event.preventDefault();
    const id = event.dataTransfer?.getData("text/plain"),
      module = this.section.modules.find((m) => m.id === id);
    if (!module) return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.layoutChanged.emit({
      id: module.id,
      position: {
        ...module.layout,
        x: Math.floor((event.clientX - rect.left) / (rect.width / 12)),
        y: Math.floor((event.clientY - rect.top) / 72),
      },
    });
  }
  startResize(event: PointerEvent, module: ModuleInstance): void {
    if (!this.editing) return;
    event.preventDefault();
    const board = (event.currentTarget as HTMLElement)
      .closest(".module-grid")!
      .getBoundingClientRect();
    this.resize = {
      id: module.id,
      startX: event.clientX,
      startY: event.clientY,
      cell: board.width / 12,
      initial: { ...module.layout },
    };
  }
  @HostListener("window:pointermove", ["$event"]) resizeMove(
    event: PointerEvent,
  ): void {
    const resize = this.resize;
    if (!resize) return;
    const module = this.section.modules.find((m) => m.id === resize.id)!,
      visual = this.visual(module)!;
    this.resizePreview.set({
      id: resize.id,
      position: {
        ...resize.initial,
        w: Math.max(
          visual.layout.minW,
          Math.min(
            12 - resize.initial.x,
            resize.initial.w +
              Math.round((event.clientX - resize.startX) / resize.cell),
          ),
        ),
        h: Math.max(
          visual.layout.minH,
          Math.min(
            12,
            resize.initial.h + Math.round((event.clientY - resize.startY) / 72),
          ),
        ),
      },
    });
  }
  @HostListener("window:pointerup") finishResize(): void {
    if (this.resizePreview()) this.layoutChanged.emit(this.resizePreview()!);
    this.resize = undefined;
    this.resizePreview.set(null);
  }
  @HostListener("window:pointercancel") cancelResize(): void {
    this.resize = undefined;
    this.resizePreview.set(null);
  }
  @HostListener("document:keydown.escape") closeMenu(): void {
    this.menu.set(null);
  }
  @HostListener("document:click", ["$event"]) outside(event: MouseEvent): void {
    if (!(event.target as Element).closest(".module-actions"))
      this.menu.set(null);
  }
}
