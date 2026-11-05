import { Component, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { DatePipe } from "@angular/common";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { combineLatest } from "rxjs";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { WorkspaceModalComponent } from "../../core/components/workspace-modal.component";
import { ProjectsStore } from "./state/projects.store";
import {
  ANALYSIS_TYPES,
  FEATURE_STATUSES,
  PROJECT_STATUSES,
  Feature,
  FeatureStatus,
  Project,
  ProjectStatus,
} from "./models/projects.models";
import {
  ProjectEditorComponent,
  EntityForm,
} from "./components/project-editor.component";
import { ProjectCardComponent } from "./components/project-card.component";
import { MaterialsComponent } from "./components/materials.component";
import { AnalysisWorkbenchComponent } from "./components/analysis-workbench.component";
@Component({
  selector: "app-projects",
  standalone: true,
  imports: [
    FormsModule,
    DatePipe,
    RouterLink,
    WorkspaceModalComponent,
    ProjectEditorComponent,
    MaterialsComponent,
    ProjectCardComponent,
    AnalysisWorkbenchComponent,
  ],
  templateUrl: "./projects.component.html",
  styleUrl: "./projects.component.css",
})
export class ProjectsComponent {
  readonly store = inject(ProjectsStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly projectId = signal("");
  readonly featureId = signal<string | undefined>(undefined);
  readonly tab = signal("overview");
  readonly initialRun = signal<string | undefined>(undefined);
  readonly project = computed(() => this.store.project(this.projectId()));
  readonly feature = computed(() => {
    const feature = this.featureId()
      ? this.store.feature(this.featureId()!)
      : undefined;
    return this.projectId() &&
      !this.project()?.featureIds?.includes(feature?.id ?? "")
      ? undefined
      : feature;
  });
  readonly area = signal("knowledge");
  readonly linkDialog = signal<"featureIds" | "knowledgeIds" | null>(null);
  readonly chosenLinks = signal(new Set<string>());
  readonly linkQuery = signal("");
  readonly allFeatures = computed(() =>
    this.store
      .record()
      .features.filter((f) =>
        f.name.toLocaleLowerCase().includes(this.query().toLocaleLowerCase()),
      ),
  );
  readonly allKnowledge = computed(() =>
    this.store
      .record()
      .materials.filter((m) =>
        (m.title + " " + m.content)
          .toLocaleLowerCase()
          .includes(this.query().toLocaleLowerCase()),
      ),
  );
  readonly directKnowledge = computed(() =>
    this.store
      .record()
      .materials.filter((m) =>
        (
          this.feature()?.knowledgeIds ??
          this.project()?.knowledgeIds ??
          []
        ).includes(m.id),
      ),
  );
  readonly candidates = computed(() =>
    (this.linkDialog() === "featureIds"
      ? this.store.record().features.map((f) => ({
          id: f.id,
          name: f.name,
          description: f.description,
        }))
      : this.store.record().materials.map((m) => ({
          id: m.id,
          name: m.title,
          description: m.content,
        }))
    ).filter((v) =>
      v.name.toLocaleLowerCase().includes(this.linkQuery().toLocaleLowerCase()),
    ),
  );
  readonly query = signal("");
  readonly status = signal("");
  readonly featureQuery = signal("");
  readonly featureStatus = signal("");
  readonly projects = computed(() =>
    this.store
      .record()
      .projects.filter(
        (p) =>
          (!this.status() || p.status === this.status()) &&
          p.name.toLocaleLowerCase().includes(this.query().toLocaleLowerCase()),
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
  );
  readonly features = computed(() => this.store.features(this.projectId()));
  readonly visibleFeatures = computed(() =>
    this.features().filter(
      (f) =>
        (!this.featureStatus() || f.status === this.featureStatus()) &&
        f.name
          .toLocaleLowerCase()
          .includes(this.featureQuery().toLocaleLowerCase()),
    ),
  );
  readonly scopedRequirements = computed(() =>
    this.store.requirements(this.projectId(), this.featureId()),
  );
  readonly scopedMaterials = computed(() =>
    this.store.materials(this.projectId(), this.featureId()),
  );
  readonly history = computed(() =>
    this.store.analyses(this.projectId(), this.featureId()),
  );
  readonly editor = signal<{
    feature: boolean;
    value: Project | Feature | null;
  } | null>(null);
  readonly confirmation = signal<{
    title: string;
    message: string;
    run: () => void;
  } | null>(null);
  readonly requirementForm = signal(false);
  requirementTitle = "";
  requirementDescription = "";
  readonly requirementError = signal("");
  readonly restoreDialog = signal(false);
  readonly backupText = signal("");
  replaceBackup = false;
  readonly importError = signal("");
  readonly projectStatuses = PROJECT_STATUSES;
  readonly featureStatuses = FEATURE_STATUSES;
  constructor() {
    combineLatest([this.route.paramMap, this.route.queryParamMap])
      .pipe(takeUntilDestroyed())
      .subscribe(([params, query]) => {
        this.projectId.set(params.get("projectId") ?? "");
        this.area.set(
          ["knowledge", "features", "projects"].includes(
            query.get("area") ?? "",
          )
            ? query.get("area")!
            : "knowledge",
        );
        this.featureId.set(params.get("featureId") ?? undefined);
        this.tab.set(
          ["overview", "features", "materials", "analysis", "history"].includes(
            query.get("tab") ?? "",
          )
            ? query.get("tab")!
            : "overview",
        );
        this.initialRun.set(query.get("run") ?? undefined);
      });
  }
  openLinks(field: "featureIds" | "knowledgeIds"): void {
    const entity = this.feature() ?? this.project();
    if (!entity) return;
    this.chosenLinks.set(
      new Set(
        field === "featureIds"
          ? (entity as Project).featureIds
          : entity.knowledgeIds,
      ),
    );
    this.linkQuery.set("");
    this.linkDialog.set(field);
  }
  toggleLink(id: string): void {
    this.chosenLinks.update((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  saveLinks(): void {
    const entity = this.feature() ?? this.project();
    const field = this.linkDialog();
    if (
      entity &&
      field &&
      this.store.setLinks(
        this.feature() ? "feature" : "project",
        entity.id,
        field,
        [...this.chosenLinks()],
      )
    )
      this.linkDialog.set(null);
  }
  unlink(id: string, field: "featureIds" | "knowledgeIds"): void {
    const entity = this.feature() ?? this.project();
    if (entity)
      this.store.setLinks(
        this.feature() ? "feature" : "project",
        entity.id,
        field,
        (field === "featureIds"
          ? (entity as Project).featureIds
          : entity.knowledgeIds)!.filter((v) => v !== id),
      );
  }
  projectStatus(value: string) {
    return PROJECT_STATUSES.find((s) => s.id === value)?.label ?? value;
  }
  featureStatusLabel(value: string) {
    return FEATURE_STATUSES.find((s) => s.id === value)?.label ?? value;
  }
  analysisType(value: string) {
    return ANALYSIS_TYPES.find((t) => t.id === value)?.label ?? value;
  }
  featureCount(projectId: string) {
    return this.store.features(projectId).length;
  }
  progress(projectId: string): number {
    const active = this.store
      .features(projectId)
      .filter((f) => f.status !== "archived");
    return active.length
      ? Math.round(
          (active.filter((f) => f.status === "completed").length /
            active.length) *
            100,
        )
      : 0;
  }
  completed(projectId: string) {
    return this.store
      .features(projectId)
      .filter((f) => f.status === "completed").length;
  }
  saveEntity(form: EntityForm): void {
    const editor = this.editor();
    if (!editor) return;
    if (editor.feature) {
      const id = this.store.saveFeature(
        this.projectId(),
        { ...form, status: form.status as FeatureStatus },
        editor.value?.id,
      );
      if (id) {
        this.editor.set(null);
        if (!editor.value)
          void this.router.navigate(["/projects/features", id]);
      }
    } else {
      const id = this.store.saveProject(
        { ...form, status: form.status as ProjectStatus },
        editor.value?.id,
      );
      if (id) {
        this.editor.set(null);
        if (!editor.value) void this.router.navigate(["/projects", id]);
      }
    }
  }
  removeProject(project: Project): void {
    this.confirmation.set({
      title: "Excluir projeto",
      message: `Excluir “${project.name}” e seu histórico de projeto? As features e os knowledges continuam nos cadastros independentes.`,
      run: () => {
        this.store.deleteProject(project.id);
        void this.router.navigate(["/projects"]);
      },
    });
  }
  removeFeature(feature: Feature): void {
    this.confirmation.set({
      title: "Excluir feature",
      message: `Excluir “${feature.name}”, seus requisitos e análises? Ela será removida dos projetos. Os knowledges serão preservados.`,
      run: () => {
        this.store.deleteFeature(feature.id);
        if (this.featureId() === feature.id)
          void this.router.navigate(["/projects"], {
            queryParams: { area: "features" },
          });
      },
    });
  }
  newRequirement(): void {
    this.requirementTitle = "";
    this.requirementDescription = "";
    this.requirementError.set("");
    this.requirementForm.set(true);
  }
  saveRequirement(): void {
    if (
      this.store.addRequirement(
        this.projectId(),
        this.featureId(),
        this.requirementTitle,
        this.requirementDescription,
      )
    )
      this.requirementForm.set(false);
    else this.requirementError.set(this.store.error());
  }
  exportBackup(projectOnly = false): void {
    try {
      const content = projectOnly
        ? this.store.exportProject(this.projectId())
        : this.store.exportBackup();
      const url = URL.createObjectURL(
        new Blob([content], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = projectOnly
        ? `projeto-${this.projectId()}.json`
        : "projetos-backup.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.store.notice.set(
        "Backup JSON exportado. Guarde uma cópia fora deste navegador.",
      );
    } catch (error) {
      this.store.error.set(
        error instanceof Error ? error.message : "Não foi possível exportar.",
      );
    }
  }
  async readBackup(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement,
      file = input.files?.[0];
    if (!file) return;
    try {
      if (file.size > 10000000) throw new Error("O backup excede 10 MB.");
      this.backupText.set(await file.text());
      this.importError.set("");
      this.replaceBackup = false;
      this.restoreDialog.set(true);
    } catch (error) {
      this.store.error.set(
        error instanceof Error
          ? error.message
          : "Não foi possível ler o backup.",
      );
    } finally {
      input.value = "";
    }
  }
  importBackup(): void {
    if (this.replaceBackup) {
      this.confirmation.set({
        title: "Restaurar backup",
        message:
          "Substituir todos os projetos, features, knowledges, requisitos e análises deste perfil pelo backup selecionado? Exporte os dados atuais antes de continuar.",
        run: () => this.applyBackup(true),
      });
    } else this.applyBackup(false);
  }
  private applyBackup(replace: boolean): void {
    if (this.store.importBackup(this.backupText(), replace)) {
      this.restoreDialog.set(false);
      this.backupText.set("");
      void this.router.navigate(["/projects"]);
    } else this.importError.set(this.store.error());
  }
}
