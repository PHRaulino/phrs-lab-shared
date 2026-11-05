import { Component, EventEmitter, Input, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { BoundFilter, FilterValue } from "../models/analytics.models";
import { label } from "../visuals/visual-components";
@Component({
  selector: "app-dashboard-filters",
  standalone: true,
  imports: [FormsModule],
  template: ` <div class="filters">
    @for (filter of filters; track filter.id) {
      <div class="filter">
        <label [for]="'filter-' + filter.id">{{
          filter.definition.label
        }}</label>
        @if (filter.definition.type === "date") {
          <input
            [id]="'filter-' + filter.id"
            type="date"
            [ngModel]="values[filter.id]?.value ?? ''"
            (ngModelChange)="changed.emit({ id: filter.id, value: $event })"
          />
        } @else {
          <select
            [id]="'filter-' + filter.id"
            [ngModel]="values[filter.id]?.value ?? ''"
            (ngModelChange)="changed.emit({ id: filter.id, value: $event })"
          >
            <option value="">Todos</option>
            @for (option of filter.definition.options ?? []; track option) {
              <option [value]="option">{{ label(option) }}</option>
            }
          </select>
        }
        <div class="filter-meta">
          <button
            type="button"
            class="impact"
            [class.active]="highlighted === filter.id"
            [attr.aria-pressed]="highlighted === filter.id"
            (click)="focused.emit(highlighted === filter.id ? null : filter.id)"
            [title]="
              'Destacar os módulos afetados por ' + filter.definition.label
            "
          >
            Aplicado a {{ filter.moduleIds.length }} de
            {{ moduleCount }} visuais
          </button>
          @if (values[filter.id]?.value) {
            <button
              class="clear-one"
              [attr.aria-label]="'Limpar ' + filter.definition.label"
              (click)="changed.emit({ id: filter.id, value: '' })"
            >
              ×
            </button>
          }
        </div>
      </div>
    }
    <button class="text-button clear-all" (click)="cleared.emit()">
      Limpar todos
    </button>
  </div>`,
  styles: [
    `
      :host {
        display: block;
        padding: 12px 16px;
        background: white;
        border: 1px solid var(--line);
        border-radius: 8px;
        margin: 12px 0 16px;
      }
      .filters {
        display: flex;
        gap: 16px;
        flex-wrap: wrap;
      }
      .clear-all {
        align-self: center;
        white-space: nowrap;
      }
      .filter {
        flex: 1;
        min-width: 150px;
        max-width: 280px;
      }
      .filter label {
        display: block;
        font-size: 10px;
        color: var(--muted);
        margin-bottom: 7px;
      }
      .filter input,
      .filter select {
        width: 100%;
      }
      .filter-meta {
        display: flex;
        justify-content: space-between;
        margin-top: 5px;
        min-height: 19px;
        gap: 6px;
      }
      .impact {
        border: 0;
        padding: 2px 0;
        background: none;
        font-size: 8px;
        text-align: left;
        color: #83926d;
      }
      .impact.active {
        color: #264b2d;
        text-decoration: underline;
      }
      .clear-one {
        border: 0;
        background: none;
        color: #7d896e;
      }
    `,
  ],
})
export class DashboardFiltersComponent {
  @Input() filters: BoundFilter[] = [];
  @Input() values: Partial<Record<string, FilterValue>> = {};
  @Input() moduleCount = 0;
  @Input() highlighted: string | null = null;
  @Output() changed = new EventEmitter<{ id: string; value: string }>();
  @Output() focused = new EventEmitter<string | null>();
  @Output() cleared = new EventEmitter<void>();
  readonly label = label;
}
