import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { WorkspaceModalComponent } from "../../../core/components/workspace-modal.component";
import {
  FEATURE_STATUSES,
  FeatureStatus,
  PROJECT_STATUSES,
  ProjectStatus,
} from "../models/projects.models";
export interface EntityForm {
  question?: string;
  name: string;
  description: string;
  objective: string;
  context: string;
  status: string;
}
@Component({
  selector: "app-project-editor",
  standalone: true,
  imports: [FormsModule, WorkspaceModalComponent],
  template: `<app-workspace-modal
    [title]="
      value
        ? feature
          ? 'Editar feature'
          : 'Editar projeto'
        : feature
          ? 'Nova feature'
          : 'Novo projeto'
    "
    (dismissed)="dismissed.emit()"
    ><form (ngSubmit)="save()">
      <label
        >Nome<input
          name="name"
          [(ngModel)]="form.name"
          required
          maxlength="160" /></label
      ><label
        >Descrição<textarea
          name="description"
          [(ngModel)]="form.description"
          rows="3"
          maxlength="20000"
        ></textarea>
      </label>
      @if (feature) {
        <label
          >Pergunta para a IA<textarea
            name="question"
            [(ngModel)]="form.question"
            rows="4"
            maxlength="20000"
            required
            placeholder="Ex.: O atendente confirmou que a solicitação do cliente foi resolvida?"
          ></textarea>
        </label>
        <p class="help">
          Esta é a pergunta que a IA responderá com base na transcrição. Vincule
          knowledges para fornecer critérios e referências.
        </p>
      }
      <label
        >{{ feature ? "Critério de avaliação (opcional)" : "Objetivo"
        }}<textarea
          name="objective"
          [(ngModel)]="form.objective"
          rows="2"
          maxlength="20000"
        ></textarea></label
      ><label
        >{{ feature ? "Orientações para avaliar (opcional)" : "Contexto geral"
        }}<textarea
          name="context"
          [(ngModel)]="form.context"
          rows="5"
          maxlength="100000"
        ></textarea></label
      ><label
        >Status<select name="status" [(ngModel)]="form.status">
          @for (status of statuses; track status.id) {
            <option [value]="status.id">{{ status.label }}</option>
          }
        </select></label
      >
      <div class="actions">
        <button type="button" class="secondary" (click)="dismissed.emit()">
          Cancelar</button
        ><button
          class="primary-button"
          type="submit"
          [disabled]="!form.name.trim() || (feature && !form.question?.trim())"
        >
          Salvar {{ feature ? "feature" : "projeto" }}
        </button>
      </div>
    </form></app-workspace-modal
  >`,
  styles: [
    `
      form {
        display: grid;
        gap: 17px;
      }
      label {
        display: grid;
        gap: 7px;
        font-size: 11px;
        color: var(--muted);
      }
      input,
      select,
      textarea {
        width: 100%;
        font-size: 12px;
      }
      textarea {
        font: inherit;
        border: 1px solid var(--line);
        border-radius: 5px;
        padding: 11px;
        resize: vertical;
        line-height: 1.7;
      }
      .actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        border-top: 1px solid var(--line);
        padding-top: 18px;
      }
      .secondary {
        background: white;
        border: 1px solid var(--line);
        color: var(--green);
        padding: 10px 14px;
        border-radius: 5px;
        font-size: 12px;
      }
    `,
  ],
})
export class ProjectEditorComponent implements OnInit {
  @Input() value: EntityForm | null = null;
  @Input() feature = false;
  @Output() saved = new EventEmitter<EntityForm>();
  @Output() dismissed = new EventEmitter<void>();
  form: EntityForm = {
    question: "",
    name: "",
    description: "",
    objective: "",
    context: "",
    status: "planning",
  };
  get statuses() {
    return this.feature ? FEATURE_STATUSES : PROJECT_STATUSES;
  }
  ngOnInit(): void {
    this.form = this.value
      ? structuredClone(this.value)
      : { ...this.form, status: this.feature ? "idea" : "planning" };
  }
  save(): void {
    if (this.form.name.trim() && (!this.feature || this.form.question?.trim()))
      this.saved.emit({ ...this.form, name: this.form.name.trim() });
  }
}
