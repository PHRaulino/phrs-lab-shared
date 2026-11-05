import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from "@angular/core";
import { DatePipe, JsonPipe } from "@angular/common";
import { Task, Workflow, duration } from "../models/observability.models";
import { StatusBadgeComponent } from "./status-badge.component";
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "app-task-detail",
  standalone: true,
  imports: [DatePipe, JsonPipe, StatusBadgeComponent],
  template: ` <div class="panel-heading">
      <h2 id="task-detail-title">Detalhes da task</h2>
      <button
        class="text-button"
        aria-label="Fechar detalhes da task"
        (click)="closed.emit()"
      >
        ×
      </button>
    </div>
    <div class="detail-content">
      <p class="eyebrow">EXECUÇÃO DEMONSTRATIVA</p>
      <h3>{{ task.name }}</h3>
      <app-status-badge [status]="task.status" /><button
        class="primary-button edit-config"
        (click)="editRequested.emit()"
      >
        ✎ Editar task.yaml
      </button>
      <section>
        <h4>Identificação</h4>
        <dl>
          <dt>Unidade de negócio</dt>
          <dd>{{ task.businessUnit }}</dd>
          <dt>Camada</dt>
          <dd>{{ task.layer }}</dd>
          <dt>Tabela</dt>
          <dd>{{ task.table }}</dd>
          <dt>Tabela de destino</dt>
          <dd>{{ task.targetTable || "Não informado" }}</dd>
          <dt>Workflow</dt>
          <dd>{{ workflowName(task.workflowId) }}</dd>
          <dt>Arquivo YAML</dt>
          <dd>
            <code>{{ task.yamlFile || "Não informado" }}</code>
          </dd>
        </dl>
      </section>
      <section>
        <h4>Execução</h4>
        <dl>
          <dt>Onda</dt>
          <dd>{{ task.wave }}</dd>
          <dt>Início</dt>
          <dd>
            {{
              (task.execution?.startedAt | date: "dd/MM/yyyy HH:mm:ss") ||
                "Não iniciado"
            }}
          </dd>
          <dt>Fim</dt>
          <dd>
            {{
              (task.execution?.finishedAt | date: "dd/MM/yyyy HH:mm:ss") ||
                "Não informado"
            }}
          </dd>
          <dt>Duração informada</dt>
          <dd>{{ formatDuration(task.execution?.durationMs) }}</dd>
        </dl>
        @if (task.execution?.error) {
          <div class="task-error">
            <strong>! Mensagem de erro</strong>
            <p>{{ task.execution?.error }}</p>
          </div>
        }
        @if (task.execution?.metadata; as metadata) {
          <details>
            <summary>Informações adicionais</summary>
            <pre>{{ metadata | json }}</pre>
          </details>
        }
      </section>
      <section>
        <h4>
          Dependências diretas <span>{{ dependencies.length }}</span>
        </h4>
        @for (item of dependencies; track item.id) {
          <button class="dependency" (click)="navigated.emit(item.id)">
            <span>{{ item.name }} ↗</span
            ><app-status-badge [status]="item.status" />
          </button>
        }
        @if (!dependencies.length) {
          <p class="muted">Sem dependências.</p>
        }
        @if (missingDependencies.length) {
          <p class="muted">
            Referências não fornecidas: {{ missingDependencies.join(", ") }}
          </p>
        }
        <h4>
          Tasks dependentes <span>{{ dependents.length }}</span>
        </h4>
        @for (item of dependents; track item.id) {
          <button class="dependency" (click)="navigated.emit(item.id)">
            <span>{{ item.name }} ↗</span
            ><app-status-badge [status]="item.status" />
          </button>
        }
        @if (!dependents.length) {
          <p class="muted">Nenhuma task dependente.</p>
        }
      </section>
      <section>
        <h4>Configuração YAML</h4>
        <p class="muted">
          Configuração de origem. Abra o editor para gerar um YAML atualizado.
        </p>
        @for (entry of configuration; track entry[0]) {
          <div class="config-entry">
            <strong>{{ entry[0] }}</strong>
            <pre>{{ entry[1] | json }}</pre>
          </div>
        }
        @if (!configuration.length) {
          <p class="muted">Configuração não fornecida.</p>
        }
      </section>
    </div>`,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }
      .detail-content {
        padding: 4px 20px 22px;
        max-height: 576px;
        overflow: auto;
      }
      .edit-config {
        display: flex;
        width: 100%;
        margin-top: 16px;
      }
      h3 {
        font-size: 18px;
        overflow-wrap: anywhere;
        margin: 14px 0;
      }
      section {
        border-top: 1px solid var(--line);
        margin-top: 22px;
        padding-top: 5px;
      }
      h4 {
        font-size: 11px;
        display: flex;
        justify-content: space-between;
        margin: 18px 0 14px;
      }
      h4 span {
        color: var(--muted);
      }
      dl {
        display: grid;
        grid-template-columns: 90px 1fr;
        gap: 12px 10px;
        font-size: 10px;
      }
      dt {
        color: var(--muted);
      }
      dd {
        margin: 0;
        overflow-wrap: anywhere;
      }
      pre {
        font-size: 10px;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        background: #f5f7f2;
        border: 1px solid var(--line);
        padding: 10px;
        border-radius: 5px;
        line-height: 1.6;
      }
      summary,
      .muted {
        font-size: 10px;
        color: var(--muted);
        line-height: 1.6;
      }
      summary {
        cursor: pointer;
      }
      .config-entry strong {
        font-family: monospace;
        font-size: 11px;
      }
      .dependency {
        display: grid;
        text-align: left;
        gap: 7px;
        background: transparent;
        border: 1px solid var(--line);
        padding: 10px;
        margin-bottom: 8px;
        border-radius: 5px;
        width: 100%;
      }
      .dependency:hover {
        background: #f3f5ee;
      }
      .dependency > span {
        font-size: 11px;
        overflow-wrap: anywhere;
      }
      .task-error {
        padding: 12px;
        border-radius: 6px;
        background: #fff1ef;
        color: #a32e30;
        font-size: 11px;
        line-height: 1.6;
      }
      .task-error p {
        margin-bottom: 0;
      }
    `,
  ],
})
export class TaskDetailComponent {
  @Input({ required: true }) task!: Task;
  @Input() tasks: Task[] = [];
  @Input() workflows: Workflow[] = [];
  @Output() editRequested = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();
  @Output() navigated = new EventEmitter<string>();
  readonly formatDuration = duration;
  get dependencies() {
    return this.tasks.filter((t) => this.task.dependencies.includes(t.id));
  }
  get dependents() {
    return this.tasks.filter((t) => t.dependencies.includes(this.task.id));
  }
  get missingDependencies() {
    return this.task.dependencies.filter(
      (id) => !this.tasks.some((t) => t.id === id),
    );
  }
  get configuration() {
    return Object.entries(this.task.configuration);
  }
  workflowName(id: string) {
    return this.workflows.find((w) => w.id === id)?.name ?? id;
  }
}
