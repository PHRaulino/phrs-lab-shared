import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { STATUS, TaskFilters, Workflow } from "../models/observability.models";
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "app-observation-filters",
  standalone: true,
  imports: [FormsModule],
  template: ` <div
    class="filter-bar"
    role="search"
    aria-label="Filtros de tasks"
  >
    <label class="search-field"
      ><span>Buscar task ou tabela</span
      ><input
        type="search"
        placeholder="⌕  Buscar task ou tabela…"
        [ngModel]="filters.search"
        (ngModelChange)="changed.emit({ search: $event })"
    /></label>
    <label
      ><span>Unidade de negócio</span
      ><select
        [ngModel]="filters.businessUnit"
        (ngModelChange)="changed.emit({ businessUnit: $event })"
      >
        <option value="">Todas as unidades</option>
        @for (unit of units; track unit) {
          <option [value]="unit">{{ unit }}</option>
        }
      </select></label
    >
    <label
      ><span>Camada de dados</span
      ><select
        [ngModel]="filters.layer"
        (ngModelChange)="changed.emit({ layer: $event })"
      >
        <option value="">Todas as camadas</option>
        @for (layer of layers; track layer) {
          <option [value]="layer">{{ layer }}</option>
        }
      </select></label
    >
    <label
      ><span>Workflow</span
      ><select
        [ngModel]="filters.workflowId"
        (ngModelChange)="changed.emit({ workflowId: $event })"
      >
        <option value="">Todos os workflows</option>
        @for (workflow of workflows; track workflow.id) {
          <option [value]="workflow.id">{{ workflow.name }}</option>
        }
      </select></label
    >
    <label
      ><span>Status de execução</span
      ><select
        [ngModel]="filters.status"
        (ngModelChange)="changed.emit({ status: $event })"
      >
        <option value="">Todos os status</option>
        @for (item of statuses; track item.key) {
          <option [value]="item.key">{{ item.label }}</option>
        }
      </select></label
    >
    <button class="text-button" (click)="cleared.emit()">Limpar</button>
  </div>`,
  styles: [
    `
      :host {
        display: block;
      }
      .filter-bar {
        display: flex;
        gap: 10px;
        align-items: end;
        flex-wrap: wrap;
      }
      label {
        flex: 1;
        min-width: 130px;
      }
      label span {
        display: block;
        font-size: 10px;
        font-weight: 600;
        color: var(--muted);
        margin-bottom: 7px;
      }
      .search-field {
        flex: 1.6;
        min-width: 200px;
      }
      input,
      select {
        width: 100%;
      }
    `,
  ],
})
export class FiltersComponent {
  @Input({ required: true }) filters!: TaskFilters;
  @Input() units: string[] = [];
  @Input() layers: string[] = [];
  @Input() workflows: Workflow[] = [];
  @Output() changed = new EventEmitter<Partial<TaskFilters>>();
  @Output() cleared = new EventEmitter<void>();
  readonly statuses = Object.entries(STATUS).map(([key, value]) => ({
    key,
    ...value,
  }));
}
