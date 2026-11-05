import {
  DestroyRef,
  Injectable,
  computed,
  inject,
  signal,
} from "@angular/core";
import { BackendModeService } from "../../../core/backend/backend-mode.service";
import { ProjectsRepository } from "../data/projects.repository";
import { AI_PROVIDER, validateAISettings } from "../data/ai-provider";
import {
  prepareContext,
  validateAnalysisResult,
  validateAttendanceContext,
  validateAttendanceResult,
} from "../data/context-engine";
import {
  migrateProjectsRecord,
  validateProjectsRecord,
} from "../data/projects-validation";
import {
  AISettings,
  AnalysisRequest,
  AnalysisRun,
  AnalysisType,
  ContextSelection,
  DEFAULT_AI_SETTINGS,
  Feature,
  FeatureStatus,
  Material,
  MaterialType,
  Project,
  ProjectsRecord,
  Requirement,
} from "../models/projects.models";
const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();
const empty = (): ProjectsRecord => ({
  schemaVersion: 2,
  ownerId: "browser-profile",
  projects: [],
  features: [],
  materials: [],
  requirements: [],
  analyses: [],
  settings: structuredClone(DEFAULT_AI_SETTINGS),
});
@Injectable({ providedIn: "root" })
export class ProjectsStore {
  private readonly repository = inject(ProjectsRepository);
  readonly provider = inject(AI_PROVIDER);
  readonly backend = inject(BackendModeService);
  private readonly destroyRef = inject(DestroyRef);
  readonly record = signal<ProjectsRecord>(empty());
  readonly loading = signal(true);
  readonly error = signal("");
  readonly notice = signal("");
  readonly saving = signal("");
  readonly analyzing = signal(false);
  readonly ready = computed(
    () =>
      this.provider.available &&
      this.provider.transport !== "none" &&
      (!this.provider.usesApplicationBackend || this.backend.enabled()),
  );
  readonly aiReason = computed(() =>
    !this.provider.available || this.provider.transport === "none"
      ? "Nenhum provedor com acesso seguro está disponível. Você pode organizar o contexto e consultar o histórico local."
      : this.provider.usesApplicationBackend && !this.backend.enabled()
        ? "Este provedor usa o backend da aplicação, que está desabilitado. Reative-o nas configurações."
        : "Provedor disponível para análise.",
  );
  private blocked = false;
  private revision = 0;
  private analysisEpoch = 0;
  private controller?: AbortController;
  constructor() {
    void this.load();
    const subscription = this.backend.changes.subscribe((enabled) => {
      if (!enabled && this.provider.usesApplicationBackend)
        this.cancelAnalysis();
    });
    this.destroyRef.onDestroy(() => {
      subscription.unsubscribe();
      this.cancelAnalysis();
    });
  }
  async load(): Promise<void> {
    try {
      const stored = await this.repository.load("browser-profile");
      if (stored) {
        const record = migrateProjectsRecord(stored);
        if (record.ownerId !== "browser-profile")
          throw new Error("O registro pertence a outro perfil.");
        this.record.set(record);
        if (stored.schemaVersion !== record.schemaVersion) await this.persist();
      }
    } catch (error) {
      this.blocked = true;
      this.error.set(
        this.message(error) +
          " Os dados existentes foram preservados. Exporte uma cópia antes de restaurar um backup.",
      );
    } finally {
      this.loading.set(false);
    }
  }
  private commit(change: (draft: ProjectsRecord) => void): boolean {
    try {
      const draft = structuredClone(this.record());
      change(draft);
      this.record.set(validateProjectsRecord(draft));
      this.error.set("");
      void this.persist();
      return true;
    } catch (error) {
      this.error.set(this.message(error));
      return false;
    }
  }
  async persist(): Promise<void> {
    if (this.blocked) {
      this.saving.set(
        "Alterações apenas nesta sessão: persistência bloqueada para preservar o registro original.",
      );
      return;
    }
    const revision = ++this.revision;
    this.saving.set("Salvando…");
    try {
      await this.repository.save(this.record());
      if (revision === this.revision) this.saving.set("Salvo neste navegador");
    } catch (error) {
      this.saving.set(
        "Falha ao salvar. Exporte um backup para preservar as alterações.",
      );
      this.error.set(this.message(error));
    }
  }
  project(id: string) {
    return this.record().projects.find((p) => p.id === id);
  }
  feature(id: string) {
    return this.record().features.find((f) => f.id === id);
  }
  features(projectId: string) {
    return this.record().features.filter((f) =>
      this.project(projectId)?.featureIds?.includes(f.id),
    );
  }
  materials(projectId: string, featureId?: string) {
    const ids = new Set([
      ...(this.project(projectId)?.knowledgeIds ?? []),
      ...(featureId
        ? (this.feature(featureId)?.knowledgeIds ?? [])
        : this.features(projectId).flatMap((f) => f.knowledgeIds ?? [])),
    ]);
    return this.record().materials.filter((m) => ids.has(m.id));
  }
  requirements(projectId: string, featureId?: string) {
    return this.record().requirements.filter((req) =>
      featureId
        ? req.featureId === featureId ||
          (!!projectId && req.projectId === projectId && !req.featureId)
        : req.projectId === projectId && !req.featureId,
    );
  }
  analyses(projectId: string, featureId?: string) {
    return this.record()
      .analyses.filter((run) =>
        featureId
          ? run.featureId === featureId &&
            (!projectId || run.projectId === projectId || !run.projectId)
          : run.projectId === projectId ||
            (!!projectId &&
              !run.projectId &&
              !!run.featureId &&
              this.features(projectId).some((f) => f.id === run.featureId)),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  saveProject(
    value: Pick<
      Project,
      "name" | "description" | "objective" | "context" | "status"
    >,
    existingId?: string,
  ): string | null {
    const projectId = existingId ?? id();
    const saved = this.commit((d) => {
      const current = d.projects.find((p) => p.id === projectId);
      if (existingId && !current) throw new Error("Projeto não encontrado.");
      if (current) Object.assign(current, value, { updatedAt: now() });
      else
        d.projects.push({
          id: projectId,
          ...value,
          featureIds: [],
          knowledgeIds: [],
          createdAt: now(),
          updatedAt: now(),
        });
    });
    return saved ? projectId : null;
  }
  deleteProject(projectId: string): void {
    this.cancelAnalysis();
    this.commit((d) => {
      d.projects = d.projects.filter((p) => p.id !== projectId);

      d.requirements = d.requirements.filter(
        (req) => req.projectId !== projectId,
      );
      d.analyses = d.analyses.filter((run) => run.projectId !== projectId);
    });
  }
  saveFeature(
    projectId: string,
    value: Pick<
      Feature,
      "name" | "description" | "objective" | "context" | "status" | "question"
    >,
    existingId?: string,
  ): string | null {
    const featureId = existingId ?? id();
    const saved = this.commit((d) => {
      const current = d.features.find((f) => f.id === featureId);
      if (existingId && !current) throw new Error("Feature não encontrada.");
      if (current) Object.assign(current, value, { updatedAt: now() });
      else
        d.features.push({
          id: featureId,
          knowledgeIds: [],
          ...value,
          createdAt: now(),
          updatedAt: now(),
        });
      const project = d.projects.find((p) => p.id === projectId);
      if (project && !project.featureIds!.includes(featureId))
        project.featureIds!.push(featureId);
      this.touch(d, projectId);
    });
    return saved ? featureId : null;
  }
  setFeatureStatus(featureId: string, status: FeatureStatus): void {
    const feature = this.feature(featureId);
    if (feature)
      this.saveFeature(
        "",
        {
          name: feature.name,
          description: feature.description,
          objective: feature.objective,
          context: feature.context,
          status,
        },
        featureId,
      );
  }
  deleteFeature(featureId: string): void {
    this.cancelAnalysis();
    this.commit((d) => {
      d.features = d.features.filter((f) => f.id !== featureId);
      for (const p of d.projects) {
        if (p.featureIds!.includes(featureId)) this.touch(d, p.id);
        p.featureIds = p.featureIds!.filter((id) => id !== featureId);
      }
      d.requirements = d.requirements.filter(
        (req) => req.featureId !== featureId,
      );
      d.analyses = d.analyses.filter((run) => run.featureId !== featureId);
    });
  }
  addMaterial(
    projectId: string,
    featureId: string | undefined,
    title: string,
    content: string,
    type: MaterialType,
  ): boolean {
    const knowledgeId = this.saveKnowledge({ title, content, type });
    if (!knowledgeId) return false;
    if (featureId)
      return this.setLinks("feature", featureId, "knowledgeIds", [
        ...(this.feature(featureId)?.knowledgeIds ?? []),
        knowledgeId,
      ]);
    if (projectId)
      return this.setLinks("project", projectId, "knowledgeIds", [
        ...(this.project(projectId)?.knowledgeIds ?? []),
        knowledgeId,
      ]);
    return true;
  }
  saveKnowledge(
    value: Pick<Material, "title" | "content" | "type">,
    existingId?: string,
  ): string | null {
    const knowledgeId = existingId ?? id();
    return this.commit((d) => {
      const current = d.materials.find((m) => m.id === knowledgeId);
      if (existingId && !current) throw new Error("Knowledge não encontrado.");
      if (current) Object.assign(current, value, { title: value.title.trim() });
      else
        d.materials.push({
          id: knowledgeId,
          ...value,
          title: value.title.trim(),
          createdAt: now(),
        });
    })
      ? knowledgeId
      : null;
  }
  deleteKnowledge(knowledgeId: string): void {
    this.commit((d) => {
      d.materials = d.materials.filter((m) => m.id !== knowledgeId);
      for (const item of [...d.projects, ...d.features])
        item.knowledgeIds = item.knowledgeIds!.filter(
          (id) => id !== knowledgeId,
        );
    });
  }
  setLinks(
    kind: "project" | "feature",
    entityId: string,
    field: "featureIds" | "knowledgeIds",
    ids: string[],
  ): boolean {
    return this.commit((d) => {
      const item =
        kind === "project"
          ? d.projects.find((p) => p.id === entityId)
          : d.features.find((f) => f.id === entityId);
      if (!item || (kind === "feature" && field === "featureIds"))
        throw new Error("Vínculo inválido.");
      if (field === "featureIds")
        (item as Project).featureIds = [...new Set(ids)];
      else item.knowledgeIds = [...new Set(ids)];
      item.updatedAt = now();
    });
  }
  addRequirement(
    projectId: string,
    featureId: string | undefined,
    title: string,
    description: string,
  ): boolean {
    return this.commit((d) => {
      d.requirements.push({
        id: id(),
        projectId,
        ...(featureId ? { featureId } : {}),
        title: title.trim(),
        description,
        status: "draft",
        createdAt: now(),
      });
      this.touch(d, projectId);
    });
  }
  approveRequirement(requirementId: string): void {
    this.commit((d) => {
      const req = d.requirements.find((r) => r.id === requirementId);
      if (req) req.status = "approved";
    });
  }
  saveSettings(settings: AISettings): boolean {
    try {
      validateAISettings(settings, this.provider);
      return this.commit((d) => {
        d.settings = settings;
      });
    } catch (error) {
      this.error.set(this.message(error));
      return false;
    }
  }
  context(
    projectId: string,
    featureId: string | undefined,
    selection: ContextSelection,
  ) {
    const project = this.project(projectId);
    if (projectId && !project) throw new Error("Projeto não encontrado.");
    if (!projectId && !featureId)
      throw new Error("Selecione um projeto ou feature.");
    if (featureId && !this.feature(featureId))
      throw new Error("Feature não encontrada.");
    return prepareContext(
      project,
      featureId ? this.feature(featureId) : undefined,
      this.record().materials,
      this.record().requirements,
      selection,
      this.features(projectId),
    );
  }
  async analyze(
    projectId: string,
    featureId: string | undefined,
    type: AnalysisType,
    instruction: string,
    selection: ContextSelection,
    parentId?: string,
  ): Promise<AnalysisRun | null> {
    if (!this.ready() || this.analyzing()) {
      this.error.set(this.aiReason());
      return null;
    }
    const settings = structuredClone(this.record().settings);
    let controller: AbortController | undefined;
    let epoch = this.analysisEpoch;
    try {
      validateAISettings(settings, this.provider);
      const context = this.context(projectId, featureId, selection);
      if (type === "attendance") validateAttendanceContext(context);
      const previous = parentId
        ? this.record().analyses.find((run) => run.id === parentId)
        : undefined;
      if (
        parentId &&
        (!previous ||
          previous.projectId !== projectId ||
          previous.featureId !== featureId ||
          previous.type !== type)
      )
        throw new Error("Refinamento fora do contexto selecionado.");
      const request: AnalysisRequest = {
        type,
        instruction,
        context,
        settings,
        ...(previous
          ? {
              previous: {
                id: previous.id,
                version: previous.version,
                result: structuredClone(previous.result),
              },
            }
          : {}),
      };
      controller = new AbortController();
      epoch = ++this.analysisEpoch;
      this.controller = controller;
      this.analyzing.set(true);
      const result = validateAnalysisResult(
        await this.provider.analyze(
          structuredClone(request),
          controller.signal,
        ),
        context.materials.map((m) => m.id),
        [
          ...(context.transcript ? ["transcript"] : []),
          ...(context.project ? ["project"] : []),
          ...(context.feature ? ["feature"] : []),
          ...(context.requirements.length ? ["requirements"] : []),
        ],
      );
      if (type === "attendance") validateAttendanceResult(result, context);
      if (
        controller.signal.aborted ||
        !this.ready() ||
        (!!projectId && !this.project(projectId)) ||
        (featureId && !this.feature(featureId))
      )
        return null;
      const run: AnalysisRun = {
        id: id(),
        projectId,
        ...(featureId ? { featureId } : {}),
        type,
        instruction,
        context,
        settings,
        result,
        providerId: this.provider.id,
        model: settings.model,
        version:
          Math.max(
            0,
            ...this.record()
              .analyses.filter(
                (a) =>
                  a.projectId === projectId &&
                  a.featureId === featureId &&
                  a.type === type,
              )
              .map((a) => a.version),
          ) + 1,
        ...(previous ? { parentId: previous.id } : {}),
        createdAt: now(),
      };
      return this.commit((d) => {
        d.analyses.push(run);
        this.touch(d, projectId);
      })
        ? run
        : null;
    } catch (error) {
      if (epoch === this.analysisEpoch && !controller?.signal.aborted)
        this.error.set(this.message(error));
      return null;
    } finally {
      if (epoch === this.analysisEpoch) {
        this.analyzing.set(false);
        this.controller = undefined;
      }
    }
  }
  cancelAnalysis(): void {
    this.analysisEpoch++;
    this.controller?.abort();
    this.controller = undefined;
    this.analyzing.set(false);
  }
  exportBackup(): string {
    return (
      JSON.stringify(validateProjectsRecord(this.record()), null, 2) + "\n"
    );
  }
  exportProject(projectId: string): string {
    const record = structuredClone(this.record());
    const project = record.projects.find((p) => p.id === projectId);
    if (!project) throw new Error("Projeto não encontrado.");
    record.projects = [project];
    record.features = record.features.filter((f) =>
      project.featureIds!.includes(f.id),
    );
    const knowledgeIds = new Set([
      ...project.knowledgeIds!,
      ...record.features.flatMap((f) => f.knowledgeIds!),
    ]);
    record.materials = record.materials.filter((m) => knowledgeIds.has(m.id));
    record.requirements = record.requirements.filter(
      (r) =>
        r.projectId === projectId ||
        (!r.projectId && record.features.some((f) => f.id === r.featureId)),
    );
    record.analyses = record.analyses.filter(
      (r) =>
        r.projectId === projectId ||
        (!r.projectId && record.features.some((f) => f.id === r.featureId)),
    );
    return JSON.stringify(validateProjectsRecord(record), null, 2) + "\n";
  }
  importBackup(text: string, replace = false): boolean {
    try {
      if (text.length > 10000000) throw new Error("O backup excede 10 MB.");
      const incoming = migrateProjectsRecord(JSON.parse(text));
      incoming.ownerId = "browser-profile";
      if (replace) {
        this.cancelAnalysis();
        this.blocked = false;
        this.record.set(incoming);
        void this.persist();
      } else {
        const current = this.record();
        const occupied = new Set(
          [
            ...current.projects,
            ...current.features,
            ...current.materials,
            ...current.requirements,
            ...current.analyses,
          ].map((v) => v.id),
        );
        if (
          [
            ...incoming.projects,
            ...incoming.features,
            ...incoming.materials,
            ...incoming.requirements,
            ...incoming.analyses,
          ].some((v) => occupied.has(v.id))
        )
          throw new Error(
            "Existem identificadores repetidos. Para restaurar este backup, use a opção de substituir com confirmação.",
          );
        if (
          !this.commit((d) => {
            d.projects.push(...incoming.projects);
            d.features.push(...incoming.features);
            d.materials.push(...incoming.materials);
            d.requirements.push(...incoming.requirements);
            d.analyses.push(...incoming.analyses);
          })
        )
          return false;
      }
      this.notice.set(
        replace
          ? "Backup restaurado neste navegador."
          : "Projetos importados sem alterar os existentes.",
      );
      return true;
    } catch (error) {
      this.error.set(this.message(error));
      return false;
    }
  }
  private touch(record: ProjectsRecord, projectId: string): void {
    const project = record.projects.find((p) => p.id === projectId);
    if (project) project.updatedAt = now();
  }
  private message(error: unknown) {
    return error instanceof Error
      ? error.message
      : "Não foi possível concluir a operação.";
  }
}
