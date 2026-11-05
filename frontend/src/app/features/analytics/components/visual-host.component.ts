import { Component, Input, OnChanges, inject, signal } from "@angular/core";
import { NgComponentOutlet } from "@angular/common";
import {
  BoundFilter,
  FilterValue,
  ModuleInstance,
  VisualDefinition,
  VisualView,
} from "../models/analytics.models";
import { DatasetService } from "../data/dataset.service";
@Component({
  selector: "app-visual-host",
  standalone: true,
  imports: [NgComponentOutlet],
  template: `@if (loading()) {
      <div class="visual-feedback" role="status">Carregando visual…</div>
    } @else if (error()) {
      <div class="visual-feedback" role="alert">
        <p>{{ error() }}</p>
        <button class="text-button" (click)="load()">Tentar novamente</button>
      </div>
    } @else {
      @if (view(); as data) {
        @if (!data.rows.length) {
          <div class="visual-feedback">
            Nenhum dado para os filtros selecionados.
          </div>
        } @else {
          <ng-container
            *ngComponentOutlet="visual.component; inputs: { view: data }"
          />
        }
        @if (data.kind !== "kpi") {
          <p class="data-note">{{ data.note }}</p>
        }
      }
    }`,
  styles: [
    `
      :host {
        display: flex;
        min-height: 0;
        flex: 1;
        flex-direction: column;
        overflow: auto;
      }
      .visual-feedback {
        display: grid;
        place-content: center;
        min-height: 100px;
        height: 100%;
        color: var(--muted);
        font-size: 11px;
        line-height: 1.6;
        text-align: center;
      }
      .data-note {
        font-size: 8px;
        color: #8c977e;
        margin: auto 0 0;
        padding-top: 10px;
      }
    `,
  ],
})
export class VisualHostComponent implements OnChanges {
  @Input({ required: true }) module!: ModuleInstance;
  @Input({ required: true }) visual!: VisualDefinition;
  @Input() filters: BoundFilter[] = [];
  @Input() values: Record<string, FilterValue> = {};
  private readonly datasets = inject(DatasetService);
  private revision = 0;
  readonly loading = signal(true);
  readonly error = signal("");
  readonly view = signal<VisualView | null>(null);
  ngOnChanges(): void {
    void this.load();
  }
  async load(): Promise<void> {
    const revision = ++this.revision;
    this.loading.set(true);
    this.error.set("");
    try {
      const view = await this.datasets.query(
        this.module,
        this.visual,
        this.filters,
        this.values,
      );
      if (revision === this.revision) {
        this.view.set(view);
        this.loading.set(false);
      }
    } catch (error) {
      if (revision === this.revision) {
        this.error.set(
          error instanceof Error ? error.message : "Erro no dataset.",
        );
        this.loading.set(false);
      }
    }
  }
}
