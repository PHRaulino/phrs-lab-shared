import { Component, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { AnalyticsStore, newId } from "./state/analytics.store";
import { VISUALS } from "./data/visual-registry";
import { DatasetService } from "./data/dataset.service";
import {
  Dashboard,
  ModuleInstance,
  VisualDefinition,
} from "./models/analytics.models";
import { DashboardBoardComponent } from "./components/dashboard-board.component";
import { DashboardFiltersComponent } from "./components/dashboard-filters.component";
import { AnalyticsModalComponent } from "./components/analytics-modal.component";
import { VisualGalleryComponent } from "./components/visual-gallery.component";
import { VisualHostComponent } from "./components/visual-host.component";
import { BackendModeService } from "../../core/backend/backend-mode.service";
@Component({
  selector: "app-analytics",
  standalone: true,
  providers: [AnalyticsStore],
  imports: [
    FormsModule,
    RouterLink,
    DashboardBoardComponent,
    DashboardFiltersComponent,
    AnalyticsModalComponent,
    VisualHostComponent,
    VisualGalleryComponent,
  ],
  templateUrl: "./analytics.component.html",
  styleUrl: "./analytics.component.css",
})
export class AnalyticsComponent {
  readonly store = inject(AnalyticsStore);
  readonly backend = inject(BackendModeService);
  private readonly datasets = inject(DatasetService);
  readonly view = signal<"official" | "personal" | "gallery" | "settings">(
    "official",
  );
  readonly registry = VISUALS;
  readonly sections = computed(() =>
    [...(this.store.selected()?.sections ?? [])].sort(
      (a, b) => a.order - b.order,
    ),
  );
  readonly selectedFilterIds = computed(
    () =>
      this.store.filters().find((f) => f.id === this.store.highlightedFilter())
        ?.moduleIds ?? null,
  );
  readonly preview = signal<VisualDefinition | null>(null);
  readonly picker = signal(false);
  readonly personalVisuals = computed(() =>
    VISUALS.filter((v) => this.store.allowed().has(v.id) && !v.private),
  );
  readonly collapsed = signal<Set<string>>(new Set());
  readonly meta = signal<"personal" | "official" | "rename" | null>(null);
  metaName = "";
  metaDescription = "";
  metaTags = "";
  readonly modalError = signal("");
  readonly destination = signal<{
    module: ModuleInstance;
    official: boolean;
  } | null>(null);
  targetId = "";
  targetSection = "";
  createNew = false;
  newName = "";
  readonly confirmation = signal<{
    title: string;
    message: string;
    run: () => void;
  } | null>(null);
  readonly configure = signal<{
    sectionId: string;
    module: ModuleInstance;
  } | null>(null);
  moduleTitle = "";
  readonly sectionDialog = signal(false);
  sectionName = "";
  readonly importMode = signal<"personal" | "official">("personal");
  get targets(): Dashboard[] {
    return this.destination()?.official
      ? this.store.drafts()
      : this.store.personal();
  }
  get targetSections() {
    return this.targets.find((d) => d.id === this.targetId)?.sections ?? [];
  }
  switchView(view: "official" | "personal" | "gallery" | "settings"): void {
    if (view === "gallery" && !this.store.policy.internal) {
      this.store.error.set("Galeria restrita à equipe interna.");
      return;
    }
    this.view.set(view);
    this.store.editing.set(false);
    if (
      view === "official" &&
      !this.store.official().some((d) => d.id === this.store.activeId()) &&
      !this.store.drafts().some((d) => d.id === this.store.activeId())
    )
      this.store.select(this.store.official()[0]?.id ?? "");
    if (
      view === "personal" &&
      !this.store.personal().some((d) => d.id === this.store.activeId())
    )
      this.store.select(this.store.personal()[0]?.id ?? "");
  }
  openMeta(mode: "personal" | "official" | "rename"): void {
    this.modalError.set("");
    const selected = this.store.selected();
    this.metaName = mode === "rename" ? (selected?.name ?? "") : "";
    this.metaDescription =
      mode === "rename" ? (selected?.description ?? "") : "";
    this.metaTags = mode === "rename" ? (selected?.tags.join(", ") ?? "") : "";
    this.meta.set(mode);
  }
  saveMeta(): void {
    try {
      const tags = [
        ...new Set(
          this.metaTags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        ),
      ];
      if (!this.metaName.trim()) throw new Error("Informe um nome.");
      if (this.meta() === "rename")
        this.store.rename(this.metaName, this.metaDescription, tags);
      else {
        const official = this.meta() === "official";
        this.store.create(this.metaName, this.metaDescription, tags, official);
        this.view.set(official ? "official" : "personal");
      }
      this.meta.set(null);
    } catch (error) {
      this.modalError.set(this.message(error));
    }
  }
  isCollapsed(id: string): boolean {
    return (
      this.store.selected()?.sections.find((s) => s.id === id)?.collapsed ||
      this.collapsed().has(id)
    );
  }
  toggleSection(id: string): void {
    if (this.store.editable()) {
      this.store.toggleSection(id);
      return;
    }
    this.collapsed.update((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  addSection(): void {
    this.sectionName = "";
    this.sectionDialog.set(true);
  }
  saveSection(): void {
    if (!this.sectionName.trim()) return;
    this.store.addSection(this.sectionName.trim());
    this.sectionDialog.set(false);
  }
  askRemoveSection(id: string, title: string): void {
    this.confirmation.set({
      title: "Excluir seção",
      message: `Excluir “${title}” e todos os seus módulos?`,
      run: () => this.store.removeSection(id),
    });
  }
  askDeleteDashboard(): void {
    this.confirmation.set({
      title: "Excluir dashboard",
      message: `Excluir “${this.store.selected()?.name}” deste navegador?`,
      run: () => this.store.deleteDashboard(),
    });
  }
  moduleAction(
    sectionId: string,
    event: { action: string; module: ModuleInstance },
  ): void {
    const module = event.module;
    if (event.action === "copy") {
      this.openDestination(module, false);
      return;
    }
    if (!this.store.editable() || !this.store.editing()) return;
    if (event.action === "remove") {
      this.confirmation.set({
        title: "Remover módulo",
        message: `Remover “${module.configuration["title"] ?? module.visualId}” desta seção?`,
        run: () => this.store.removeModule(sectionId, module.id),
      });
      return;
    }
    if (event.action === "configure") {
      this.moduleTitle = String(module.configuration["title"] ?? "");
      this.configure.set({ sectionId, module });
      return;
    }
    const p = { ...module.layout };
    if (event.action === "left") p.x--;
    if (event.action === "right") p.x++;
    if (event.action === "up") p.y--;
    if (event.action === "down") p.y++;
    if (event.action === "wider") p.w++;
    if (event.action === "narrower") p.w--;
    if (event.action === "taller") p.h++;
    if (event.action === "shorter") p.h--;
    this.store.layout(sectionId, module.id, p);
  }
  saveModuleTitle(): void {
    const context = this.configure();
    if (!context || !this.moduleTitle.trim()) return;
    this.store.update((d) => {
      const module = d.sections
        .find((s) => s.id === context.sectionId)
        ?.modules.find((m) => m.id === context.module.id);
      if (module) module.configuration["title"] = this.moduleTitle.trim();
    });
    this.configure.set(null);
  }
  private readonly previewModules = new Map<string, ModuleInstance>();
  blueprint(visual: VisualDefinition): ModuleInstance {
    const cached = this.previewModules.get(visual.id);
    if (cached) return cached;
    const module: ModuleInstance = {
      id: `preview-${visual.id}`,
      visualId: visual.id,
      configuration: { title: visual.name },
      layout: {
        x: 0,
        y: 0,
        w: visual.layout.defaultW,
        h: visual.layout.defaultH,
      },
    };
    this.previewModules.set(visual.id, module);
    return module;
  }
  selectVisual(visual: VisualDefinition): void {
    this.picker.set(false);
    this.openDestination(
      this.blueprint(visual),
      this.store.selected()?.visibility === "official" && this.store.editable(),
    );
  }
  openDestination(module: ModuleInstance, official: boolean): void {
    this.modalError.set("");
    this.destination.set({ module, official });
    const items = this.targets;
    this.targetId = items.some((d) => d.id === this.store.activeId())
      ? this.store.activeId()
      : (items[0]?.id ?? "");
    this.targetSection = this.targetSections[0]?.id ?? "";
    this.createNew = !items.length;
    this.newName = "";
  }
  chooseTarget(id: string): void {
    this.targetId = id;
    this.targetSection = this.targetSections[0]?.id ?? "";
  }
  addToDestination(): void {
    try {
      const context = this.destination();
      if (!context) return;
      if (this.createNew) {
        if (!this.newName.trim())
          throw new Error("Informe o nome da nova dashboard.");
        this.targetId = this.store.create(
          this.newName,
          "",
          [],
          context.official,
        );
        this.targetSection = this.store.selected()!.sections[0].id;
      }
      if (!this.targetId || !this.targetSection)
        throw new Error("Selecione uma dashboard e uma seção.");
      this.store.addModule(context.module, this.targetId, this.targetSection);
      this.destination.set(null);
      this.view.set(context.official ? "official" : "personal");
      this.store.select(this.targetId);
      this.store.notice.set(
        "Visual adicionado. A composição foi salva apenas neste navegador.",
      );
    } catch (error) {
      this.modalError.set(this.message(error));
    }
  }
  galleryAdd(visual: VisualDefinition): void {
    this.openDestination(this.blueprint(visual), true);
  }
  exportJson(publish = false): void {
    try {
      const content = this.store.exportDefinition(publish);
      const url = URL.createObjectURL(
        new Blob([content], { type: "application/json" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `${this.store.selected()!.id}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.store.notice.set(
        publish
          ? "Definição oficial exportada. Distribua o arquivo versionado junto ao frontend para disponibilizá-la a todos."
          : "Definição JSON exportada.",
      );
    } catch (error) {
      this.store.error.set(this.message(error));
    }
  }
  async importFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      if (file.size > 1000000) throw new Error("Arquivo maior que 1 MB.");
      await this.store.importDefinition(
        await file.text(),
        this.importMode() === "official",
      );
      this.view.set(this.importMode() === "official" ? "official" : "personal");
    } catch (error) {
      this.store.error.set(this.message(error));
    } finally {
      input.value = "";
    }
  }
  clearCache(): void {
    this.datasets.clear();
    this.store.notice.set(
      "Cache de datasets limpo. Os visuais serão consultados novamente ao abrir uma dashboard.",
    );
  }
  private message(error: unknown): string {
    return error instanceof Error
      ? error.message
      : "Não foi possível concluir a operação.";
  }
}
