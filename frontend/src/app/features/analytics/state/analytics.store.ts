import { Injectable, computed, inject, signal } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom } from "rxjs";
import { AnalyticsRepository } from "../data/analytics.repository";
import { AnalyticsPolicy } from "../data/analytics-policy.service";
import { VISUALS } from "../data/visual-registry";
import {
  publishedVisualIds,
  validateDashboard,
} from "../data/dashboard-validation";
import {
  AnalyticsRecord,
  Dashboard,
  FilterValue,
  GridPosition,
  ModuleInstance,
} from "../models/analytics.models";
import { consolidateFilters, resolveFilterValues } from "./filter-engine";
import { arrangeGrid } from "./grid-layout";
export const newId = () => crypto.randomUUID();
@Injectable()
export class AnalyticsStore {
  readonly policy = inject(AnalyticsPolicy);
  private readonly repository = inject(AnalyticsRepository);
  private readonly http = inject(HttpClient);
  readonly official = signal<Dashboard[]>([]);
  readonly personal = signal<Dashboard[]>([]);
  readonly drafts = signal<Dashboard[]>([]);
  readonly loading = signal(true);
  readonly error = signal("");
  readonly notice = signal("");
  readonly saveState = signal("");
  readonly activeId = signal("operations");
  readonly editing = signal(false);
  readonly highlightedFilter = signal<string | null>(null);
  readonly filterStates = signal<Record<string, Record<string, FilterValue>>>(
    {},
  );
  private blocked = false;
  private saveRevision = 0;
  readonly all = computed(() => [
    ...this.official(),
    ...this.personal(),
    ...(this.policy.internal ? this.drafts() : []),
  ]);
  readonly selected = computed(
    () => this.all().find((d) => d.id === this.activeId()) ?? null,
  );
  readonly editable = computed(
    () =>
      this.selected()?.visibility === "personal" ||
      (this.policy.internal &&
        this.drafts().some((d) => d.id === this.activeId())),
  );
  readonly modules = computed(
    () => this.selected()?.sections.flatMap((s) => s.modules) ?? [],
  );
  readonly filters = computed(() =>
    consolidateFilters(this.modules(), VISUALS),
  );
  readonly values = computed(() => this.filterStates()[this.activeId()] ?? {});
  readonly allowed = computed(() =>
    publishedVisualIds(this.official(), VISUALS),
  );
  constructor() {
    void this.initialize();
  }
  async initialize(): Promise<void> {
    this.loading.set(true);
    this.error.set("");
    try {
      const definitions = await firstValueFrom(
        this.http.get<unknown>("assets/analytics/official-dashboards.json"),
      );
      if (!Array.isArray(definitions))
        throw new Error("Catálogo oficial inválido.");
      const allowed = new Set(
        VISUALS.filter((v) => !v.private).map((v) => v.id),
      );
      const official = definitions.map((d) =>
        validateDashboard(d, VISUALS, allowed),
      );
      if (
        official.some((d) => d.visibility !== "official" || !d.published) ||
        new Set(official.map((d) => d.id)).size !== official.length
      )
        throw new Error("Catálogo oficial inconsistente.");
      this.official.set(official);
    } catch (error) {
      this.error.set(this.message(error));
    }
    try {
      const record = await this.repository.load(this.policy.ownerId);
      if (record) {
        if (
          record.schemaVersion !== 1 ||
          record.ownerId !== this.policy.ownerId ||
          !Array.isArray(record.dashboards) ||
          !Array.isArray(record.officialDrafts)
        )
          throw new Error(
            "Versão local incompatível. Seus dados originais foram preservados; nenhuma gravação automática será feita.",
          );
        const personal = record.dashboards.map((d) =>
          validateDashboard(d, VISUALS, this.allowed(), this.policy.ownerId),
        );
        const drafts = record.officialDrafts.map((d) =>
          validateDashboard(
            d,
            VISUALS,
            new Set(VISUALS.filter((v) => !v.private).map((v) => v.id)),
          ),
        );
        if (
          personal.some((d) => d.visibility !== "personal") ||
          drafts.some((d) => d.visibility !== "official" || d.published) ||
          new Set([...personal, ...drafts].map((d) => d.id)).size !==
            personal.length + drafts.length
        )
          throw new Error(
            "Configuração local inconsistente. Os registros originais foram preservados.",
          );
        this.personal.set(personal);
        this.drafts.set(drafts);
        const states: Record<string, Record<string, FilterValue>> = {};
        for (const [id, values] of Object.entries(record.filters ?? {})) {
          if (!values || typeof values !== "object") continue;
          states[id] = Object.fromEntries(
            Object.entries(values).filter(
              ([, v]) =>
                v &&
                typeof v.value === "string" &&
                ["eq", "in", "gte", "lte"].includes(v.operator),
            ),
          );
        }
        this.filterStates.set(states);
      }
    } catch (error) {
      this.blocked = true;
      this.error.set(this.message(error));
    }
    this.loading.set(false);
  }
  select(id: string): void {
    this.activeId.set(id);
    this.editing.set(false);
    this.highlightedFilter.set(null);
    this.notice.set("");
  }
  create(
    name: string,
    description: string,
    tags: string[],
    official = false,
  ): string {
    if (official && !this.policy.internal)
      throw new Error("Composição oficial não autorizada.");
    const dashboard: Dashboard = {
      schemaVersion: 1,
      id: newId(),
      name: name.trim(),
      description,
      tags,
      visibility: official ? "official" : "personal",
      ...(official ? {} : { ownerId: this.policy.ownerId }),
      published: false,
      updatedAt: new Date().toISOString(),
      sections: [
        {
          id: newId(),
          title: "Visão geral",
          order: 0,
          layout: { columns: 12, gap: 12 },
          modules: [],
        },
      ],
    };
    validateDashboard(
      dashboard,
      VISUALS,
      official
        ? new Set(VISUALS.filter((v) => !v.private).map((v) => v.id))
        : this.allowed(),
      this.policy.ownerId,
    );
    (official ? this.drafts : this.personal).update((items) => [
      ...items,
      dashboard,
    ]);
    this.select(dashboard.id);
    this.editing.set(true);
    void this.persist();
    return dashboard.id;
  }
  update(change: (dashboard: Dashboard) => void): boolean {
    const current = this.selected();
    if (!current || !this.editable()) return false;
    try {
      const next = structuredClone(current);
      change(next);
      next.updatedAt = new Date().toISOString();
      validateDashboard(
        next,
        VISUALS,
        next.visibility === "personal"
          ? this.allowed()
          : new Set(VISUALS.filter((v) => !v.private).map((v) => v.id)),
        this.policy.ownerId,
      );
      const collection =
        next.visibility === "personal" ? this.personal : this.drafts;
      collection.update((items) =>
        items.map((d) => (d.id === next.id ? next : d)),
      );
      this.error.set("");
      void this.persist();
      return true;
    } catch (error) {
      this.error.set(this.message(error));
      return false;
    }
  }
  rename(name: string, description: string, tags: string[]): void {
    this.update((d) => {
      d.name = name.trim();
      d.description = description;
      d.tags = tags;
    });
  }
  addSection(title: string): void {
    this.update((d) => {
      d.sections.push({
        id: newId(),
        title,
        order: d.sections.length,
        layout: { columns: 12, gap: 12 },
        modules: [],
      });
    });
  }
  renameSection(id: string, title: string): void {
    this.update((d) => {
      const section = d.sections.find((s) => s.id === id);
      if (section) section.title = title.trim();
    });
  }
  moveSection(id: string, direction: number): void {
    this.update((d) => {
      const ordered = [...d.sections].sort((a, b) => a.order - b.order),
        i = ordered.findIndex((s) => s.id === id),
        target = i + direction;
      if (target < 0 || target >= ordered.length) return;
      [ordered[i], ordered[target]] = [ordered[target], ordered[i]];
      ordered.forEach((s, index) => (s.order = index));
      d.sections = ordered;
    });
  }
  toggleSection(id: string): void {
    if (this.editable())
      this.update((d) => {
        const section = d.sections.find((s) => s.id === id);
        if (section) section.collapsed = !section.collapsed;
      });
  }
  removeSection(id: string): void {
    this.update((d) => {
      d.sections = d.sections.filter((s) => s.id !== id);
      d.sections
        .sort((a, b) => a.order - b.order)
        .forEach((s, index) => (s.order = index));
    });
  }
  removeModule(sectionId: string, id: string): void {
    this.update((d) => {
      const section = d.sections.find((s) => s.id === sectionId);
      if (section) section.modules = section.modules.filter((m) => m.id !== id);
    });
  }
  layout(sectionId: string, id: string, position: GridPosition): void {
    this.update((d) => {
      const section = d.sections.find((s) => s.id === sectionId),
        module = section?.modules.find((m) => m.id === id),
        visual = VISUALS.find((v) => v.id === module?.visualId);
      if (section && visual)
        section.modules = arrangeGrid(section.modules, id, {
          ...position,
          w: Math.max(visual.layout.minW, Math.min(12, position.w)),
          h: Math.max(visual.layout.minH, Math.min(12, position.h)),
        });
    });
  }
  addModule(source: ModuleInstance, targetId: string, sectionId: string): void {
    const target = this.all().find((d) => d.id === targetId);
    const allowed =
      target?.visibility === "personal"
        ? this.allowed()
        : new Set(VISUALS.filter((v) => !v.private).map((v) => v.id));
    if (
      !target ||
      !allowed.has(source.visualId) ||
      (target.visibility === "official" &&
        (!this.policy.internal ||
          !this.drafts().some((d) => d.id === target.id)))
    )
      throw new Error("Visual ou destino não autorizado.");
    const previous = this.activeId();
    this.activeId.set(target.id);
    const added = this.update((d) => {
      const section = d.sections.find((s) => s.id === sectionId);
      if (!section) throw new Error("Seção de destino não encontrada.");
      const visual = VISUALS.find((v) => v.id === source.visualId)!;
      section.modules.push({
        id: newId(),
        visualId: source.visualId,
        configuration: structuredClone(source.configuration),
        layout: {
          x: 0,
          y: Math.max(
            0,
            ...section.modules.map((m) => m.layout.y + m.layout.h),
          ),
          w: Math.max(visual.layout.minW, source.layout.w),
          h: Math.max(visual.layout.minH, source.layout.h),
        },
      });
    });
    this.activeId.set(previous);
    if (!added)
      throw new Error(this.error() || "Não foi possível adicionar o módulo.");
    this.notice.set("Visual adicionado à dashboard de destino.");
  }
  setFilter(
    id: string,
    value: string,
    operator?: FilterValue["operator"],
  ): void {
    const filter = this.filters().find((f) => f.id === id);
    if (!filter) return;
    this.filterStates.update((states) => ({
      ...states,
      [this.activeId()]: {
        ...states[this.activeId()],
        [id]: { value, operator: operator ?? filter.definition.operators[0] },
      },
    }));
    void this.persist();
  }
  clearFilters(): void {
    this.filterStates.update((states) => ({
      ...states,
      [this.activeId()]: Object.fromEntries(
        this.filters().map((filter) => [
          filter.id,
          { value: "", operator: filter.definition.operators[0] },
        ]),
      ),
    }));
    this.highlightedFilter.set(null);
    void this.persist();
  }
  async persist(): Promise<void> {
    if (this.blocked) {
      this.saveState.set(
        "Persistência bloqueada para preservar registros existentes. Use exportar JSON.",
      );
      return;
    }
    const revision = ++this.saveRevision;
    this.saveState.set("Salvando…");
    const record: AnalyticsRecord = {
      schemaVersion: 1,
      ownerId: this.policy.ownerId,
      dashboards: this.personal(),
      officialDrafts: this.drafts(),
      filters: this.filterStates(),
    };
    try {
      await this.repository.save(record);
      if (revision === this.saveRevision)
        this.saveState.set("Salvo neste navegador");
    } catch (error) {
      this.saveState.set(this.message(error));
    }
  }
  async importDefinition(text: string, official = false): Promise<void> {
    if (text.length > 1000000) throw new Error("Arquivo maior que 1 MB.");
    if (official && !this.policy.internal)
      throw new Error("Importação oficial não autorizada.");
    const parsed = JSON.parse(text);
    const draft = {
      ...parsed,
      id: newId(),
      visibility: official ? "official" : "personal",
      published: false,
      ownerId: official ? undefined : this.policy.ownerId,
      updatedAt: new Date().toISOString(),
    };
    const dashboard = validateDashboard(
      draft,
      VISUALS,
      official
        ? new Set(VISUALS.filter((v) => !v.private).map((v) => v.id))
        : this.allowed(),
      this.policy.ownerId,
    );
    (official ? this.drafts : this.personal).update((items) => [
      ...items,
      dashboard,
    ]);
    this.select(dashboard.id);
    await this.persist();
    this.notice.set("Definição importada como composição local.");
  }
  exportDefinition(publish = false): string {
    const selected = this.selected();
    if (!selected) throw new Error("Selecione uma dashboard.");
    if (
      publish &&
      (!this.policy.internal ||
        selected.visibility !== "official" ||
        !this.drafts().some((d) => d.id === selected.id))
    )
      throw new Error("Publicação não autorizada.");
    const definition = validateDashboard(
      { ...selected, ...(publish ? { published: true } : {}) },
      VISUALS,
      selected.visibility === "personal"
        ? this.allowed()
        : new Set(VISUALS.filter((v) => !v.private).map((v) => v.id)),
      this.policy.ownerId,
    );
    return JSON.stringify(definition, null, 2) + "\n";
  }
  deleteDashboard(): void {
    const current = this.selected();
    if (!current || !this.editable()) return;
    (current.visibility === "personal" ? this.personal : this.drafts).update(
      (items) => items.filter((d) => d.id !== current.id),
    );
    this.activeId.set(this.official()[0]?.id ?? "");
    this.editing.set(false);
    void this.persist();
  }
  private message(error: unknown): string {
    return error instanceof Error
      ? error.message
      : "Não foi possível concluir a operação.";
  }
}
