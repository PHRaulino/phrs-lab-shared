import {
  DestroyRef,
  Injectable,
  computed,
  inject,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { interval } from "rxjs";
import { ObservabilitySource } from "../data/observability-source.service";
import {
  EMPTY_FILTERS,
  ObservationSnapshot,
  TaskFilters,
  duration,
} from "../models/observability.models";
import {
  elapsed,
  filterTasks,
  summary,
  waveSummaries,
} from "./observability.utils";

@Injectable()
export class ObservabilityStore {
  readonly source = inject(ObservabilitySource);
  private readonly destroyRef = inject(DestroyRef);
  readonly snapshot = signal<ObservationSnapshot | null>(null);
  readonly filters = signal<TaskFilters>({ ...EMPTY_FILTERS });
  readonly scenario = signal<"standard" | "large">("standard");
  readonly selectedId = signal<string | null>(null);
  readonly selectedWave = signal<string | null>(null);
  readonly focusRequest = signal<{ id: string; revision: number } | null>(null);
  readonly loading = signal(false);
  readonly error = signal("");
  readonly autoRefresh = signal(this.source.isDemo);
  readonly tasks = computed(() => this.snapshot()?.tasks ?? []);
  readonly visible = computed(() => filterTasks(this.tasks(), this.filters()));
  readonly metrics = computed(() => summary(this.visible()));
  readonly duration = computed(() =>
    duration(elapsed(this.visible(), this.snapshot()?.observedAt ?? "")),
  );
  readonly waves = computed(() =>
    waveSummaries(this.snapshot(), this.visible()),
  );
  readonly selected = computed(
    () => this.tasks().find((t) => t.id === this.selectedId()) ?? null,
  );
  readonly workflows = computed(() => {
    const ids = new Set(this.visible().map((task) => task.workflowId));
    return (
      this.snapshot()?.workflows.filter((workflow) => ids.has(workflow.id)) ??
      []
    );
  });
  readonly units = computed(() =>
    [...new Set(this.tasks().map((t) => t.businessUnit))].sort(),
  );
  readonly layers = computed(() =>
    [
      ...new Set(
        this.tasks()
          .filter(
            (t) =>
              !this.filters().businessUnit ||
              t.businessUnit === this.filters().businessUnit,
          )
          .map((t) => t.layer),
      ),
    ].sort(),
  );
  constructor() {
    this.refresh();
    interval(15000)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        if (this.autoRefresh() && this.source.isDemo && !document.hidden)
          this.refresh();
      });
  }
  refresh(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.source
      .read(this.scenario())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (snapshot) => {
          this.snapshot.set(snapshot);
          this.loading.set(false);
          this.error.set("");
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.error.set(
            error instanceof Error
              ? error.message
              : "Não foi possível atualizar os dados. Tente novamente.",
          );
        },
      });
  }
  setFilters(patch: Partial<TaskFilters>): void {
    this.filters.update((current) => ({
      ...current,
      ...patch,
      ...(patch.businessUnit !== undefined ? { layer: "" } : {}),
    }));
    this.selectedWave.set(null);
    if (!this.visible().some((t) => t.id === this.selectedId()))
      this.selectedId.set(null);
  }
  reset(): void {
    this.filters.set({ ...EMPTY_FILTERS });
    this.selectedWave.set(null);
  }
  reveal(id: string): void {
    const task = this.tasks().find((t) => t.id === id);
    if (!task) return;
    if (!this.visible().some((t) => t.id === id)) this.reset();
    this.selectedId.set(id);
    this.selectedWave.set(null);
    this.focusRequest.set({
      id,
      revision: (this.focusRequest()?.revision ?? 0) + 1,
    });
  }
  changeScenario(value: string): void {
    if (this.loading()) return;
    this.scenario.set(value === "large" ? "large" : "standard");
    this.snapshot.set(null);
    this.selectedId.set(null);
    this.reset();
    this.refresh();
  }
}
