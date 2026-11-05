import { Component, Input, OnChanges, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { DatePipe, JsonPipe } from "@angular/common";
import { RouterLink } from "@angular/router";
import {
  ANALYSIS_TYPES,
  MATERIAL_TYPES,
  AnalysisRun,
  AnalysisType,
  ContextSelection,
  PreparedContext,
} from "../models/projects.models";
import { validateAttendanceContext } from "../data/context-engine";
import { ProjectsStore } from "../state/projects.store";
import { AnalysisResultsComponent } from "./analysis-results.component";
@Component({
  selector: "app-project-analysis",
  standalone: true,
  imports: [
    FormsModule,
    DatePipe,
    JsonPipe,
    RouterLink,
    AnalysisResultsComponent,
  ],
  templateUrl: "./analysis-workbench.component.html",
  styleUrl: "./analysis-workbench.component.css",
})
export class AnalysisWorkbenchComponent implements OnChanges {
  readonly store = inject(ProjectsStore);
  @Input({ required: true }) projectId = "";
  @Input() featureId?: string;
  @Input() initialRunId?: string;
  get types() {
    return ANALYSIS_TYPES.filter(
      (t) => t.id === "attendance" || t.id === this.type,
    );
  }
  type: AnalysisType = "attendance";
  transcript = "";
  readonly selectedFeatures = signal(new Set<string>());
  get questions() {
    return this.feature ? [this.feature] : this.store.features(this.projectId);
  }
  instruction = "";
  includeProject = false;
  includeFeature = false;
  readonly selectedMaterials = signal(new Set<string>());
  readonly selectedRequirements = signal(new Set<string>());
  readonly preview = signal<PreparedContext | null>(null);
  readonly error = signal("");
  readonly selectedRunId = signal("");
  compareId = "";
  previousId = "";
  materialType(type: string) {
    return MATERIAL_TYPES.find((t) => t.id === type)?.label ?? type;
  }
  get project() {
    return this.store.project(this.projectId);
  }
  get feature() {
    return this.featureId ? this.store.feature(this.featureId) : undefined;
  }
  get materials() {
    return this.store.materials(this.projectId, this.featureId);
  }
  get requirements() {
    return this.store.requirements(this.projectId, this.featureId);
  }
  get runs() {
    return this.store
      .analyses(this.projectId, this.featureId)
      .filter(
        (run) =>
          run.featureId === this.featureId && run.projectId === this.projectId,
      );
  }
  get selected() {
    return this.runs.find((run) => run.id === this.selectedRunId()) ?? null;
  }
  get comparable() {
    return this.runs.filter(
      (run) => run.id !== this.selected?.id && run.type === this.selected?.type,
    );
  }
  get comparison() {
    return this.comparable.find((run) => run.id === this.compareId) ?? null;
  }
  get selection(): ContextSelection {
    return {
      ...(this.type === "attendance"
        ? {
            transcript: this.transcript,
            featureIds: [...this.selectedFeatures()],
          }
        : {}),
      includeProject: this.includeProject,
      includeFeature: this.includeFeature,
      materialIds: [...this.selectedMaterials()],
      requirementIds: [...this.selectedRequirements()],
    };
  }
  ngOnChanges(): void {
    this.selectedMaterials.set(new Set());
    this.selectedRequirements.set(new Set());
    this.preview.set(null);
    this.selectedRunId.set(this.initialRunId ?? "");
    this.previousId = "";
    this.compareId = "";
    this.includeProject = false;
    this.includeFeature = false;
    this.type = "attendance";
    this.transcript = "";
    this.selectedFeatures.set(
      new Set(
        this.featureId && this.feature?.question?.trim()
          ? [this.featureId]
          : [],
      ),
    );
  }
  toggle(id: string, kind: "material" | "requirement"): void {
    const target =
      kind === "material" ? this.selectedMaterials : this.selectedRequirements;
    target.update((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    this.preview.set(null);
  }
  toggleFeature(id: string): void {
    this.selectedFeatures.update((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    this.preview.set(null);
  }
  prepare(): void {
    try {
      const context = this.store.context(
        this.projectId,
        this.featureId,
        this.selection,
      );
      if (this.type === "attendance") validateAttendanceContext(context);
      this.preview.set(context);
      this.error.set("");
    } catch (error) {
      this.error.set(
        error instanceof Error
          ? error.message
          : "Não foi possível preparar o contexto.",
      );
    }
  }
  async analyze(): Promise<void> {
    const run = await this.store.analyze(
      this.projectId,
      this.featureId,
      this.type,
      this.instruction,
      this.selection,
      this.previousId || undefined,
    );
    if (run) {
      this.selectedRunId.set(run.id);
      this.previousId = "";
      this.compareId = "";
    }
  }
  selectRun(id: string): void {
    this.selectedRunId.set(id);
    this.compareId = "";
  }
  refine(run: AnalysisRun): void {
    this.previousId = run.id;
    this.type = run.type;
    this.transcript = run.context.transcript ?? "";
    this.selectedFeatures.set(
      new Set(
        (run.context.evaluationQuestions ?? [])
          .filter((q) => this.questions.some((f) => f.id === q.featureId))
          .map((q) => q.featureId),
      ),
    );
    this.instruction =
      "Refine a análise anterior considerando os esclarecimentos abaixo:\n";
    this.includeProject = !!run.context.project && !!this.project;
    this.includeFeature = !!run.context.feature;
    this.selectedMaterials.set(
      new Set(
        run.context.materials
          .map((m) => m.id)
          .filter((id) => this.materials.some((m) => m.id === id)),
      ),
    );
    this.selectedRequirements.set(
      new Set(
        run.context.requirements
          .map((r) => r.id)
          .filter((id) => this.requirements.some((r) => r.id === id)),
      ),
    );
    this.preview.set(null);
  }
}
