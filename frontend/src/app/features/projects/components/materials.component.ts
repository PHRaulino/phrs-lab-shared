import {
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
  signal,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { DatePipe } from "@angular/common";
import { WorkspaceModalComponent } from "../../../core/components/workspace-modal.component";
import {
  MATERIAL_TYPES,
  Material,
  MaterialType,
} from "../models/projects.models";
import { ProjectsStore } from "../state/projects.store";
@Component({
  selector: "app-project-materials",
  standalone: true,
  imports: [FormsModule, DatePipe, WorkspaceModalComponent],
  template: `<div class="materials-heading">
      <div>
        <h3>Knowledge</h3>
        <p>
          Políticas, procedimentos e critérios usados como referência na
          avaliação dos atendimentos.
        </p>
      </div>
      <button class="secondary" (click)="openForm()">+ Novo knowledge</button>
    </div>
    <div class="material-list">
      @for (material of materials; track material.id) {
        <button class="material-card" (click)="reading.set(material)">
          <span class="material-icon">{{
            material.type === "transcript" ? "≋" : "▤"
          }}</span
          ><span
            ><strong>{{ material.title }}</strong
            ><small
              >{{ typeLabel(material.type) }} ·
              {{ material.createdAt | date: "dd/MM/yyyy HH:mm" }} · Knowledge
              reutilizável</small
            >
            <p>
              {{ material.content.slice(0, 170)
              }}{{ material.content.length > 170 ? "…" : "" }}
            </p></span
          ><span>↗</span>
        </button>
      }
      @if (!materials.length) {
        <div class="empty-materials">
          Nenhum knowledge cadastrado. Adicione referências para apoiar as
          perguntas de avaliação.
        </div>
      }
    </div>
    @if (adding()) {
      <app-workspace-modal
        [title]="editingId ? 'Editar knowledge' : 'Novo knowledge'"
        (dismissed)="adding.set(false)"
        ><form class="material-form" (ngSubmit)="save()">
          <label
            >Título<input
              name="title"
              [(ngModel)]="title"
              maxlength="160"
              required /></label
          ><label
            >Tipo<select name="type" [(ngModel)]="type">
              @for (item of types; track item.id) {
                <option [value]="item.id">{{ item.label }}</option>
              }
            </select></label
          ><label
            >Conteúdo original<textarea
              name="content"
              [(ngModel)]="content"
              rows="12"
              maxlength="200000"
              placeholder="Cole o texto, a ideia ou a transcrição…"
              required
            ></textarea></label
          ><label class="file-input"
            >Ou importar um documento textual<input
              type="file"
              accept=".txt,.md,.csv,.json,text/plain,text/markdown,text/csv,application/json"
              aria-label="Importar documento textual"
              (change)="readFile($event)"
          /></label>
          <p class="help">
            Arquivos textuais de até 1 MB. Áudio e imagens poderão ser
            integrados futuramente.
          </p>
          @if (error()) {
            <p class="error" role="alert">{{ error() }}</p>
          }
          <div class="actions">
            <button type="button" class="secondary" (click)="adding.set(false)">
              Cancelar</button
            ><button
              type="submit"
              class="primary-button"
              [disabled]="!title.trim() || !content.trim()"
            >
              Salvar knowledge
            </button>
          </div>
        </form></app-workspace-modal
      >
    }
    @if (reading(); as material) {
      <app-workspace-modal
        [title]="material.title"
        (dismissed)="reading.set(null)"
        ><p class="help">
          {{ typeLabel(material.type) }} · Original incluído em
          {{ material.createdAt | date: "dd/MM/yyyy HH:mm" }}
        </p>
        <textarea
          class="original"
          aria-label="Conteúdo do knowledge"
          readonly
          [value]="material.content"
          rows="16"
        ></textarea>
        <div class="actions">
          <button class="secondary" (click)="edit(material)">
            Editar knowledge
          </button>
        </div>
      </app-workspace-modal>
    }`,
  styles: [
    `
      :host {
        display: block;
      }
      .materials-heading {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 15px;
        margin: 24px 0 16px;
      }
      h3 {
        font-size: 15px;
        font-weight: 550;
        margin: 0 0 7px;
      }
      .materials-heading p,
      .help {
        font-size: 11px;
        color: var(--muted);
        line-height: 1.7;
        margin: 0;
      }
      .material-list {
        display: grid;
        gap: 10px;
      }
      .material-card {
        display: flex;
        align-items: flex-start;
        gap: 14px;
        width: 100%;
        text-align: left;
        background: #fff;
        border: 1px solid var(--line);
        border-radius: 8px;
        padding: 17px;
        color: var(--ink);
      }
      .material-card > span:nth-child(2) {
        flex: 1;
        min-width: 0;
      }
      .material-icon {
        color: #899f70;
        font-size: 23px;
      }
      .material-card strong {
        font-size: 12px;
        font-weight: 550;
        overflow-wrap: anywhere;
      }
      .material-card small {
        display: block;
        font-size: 9px;
        color: #8e9b7e;
        margin-top: 7px;
      }
      .material-card p {
        font-size: 11px;
        color: var(--muted);
        line-height: 1.7;
        margin: 9px 0 0;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
      .material-card:hover {
        border-color: #acbe93;
      }
      .empty-materials {
        padding: 30px;
        border: 1px dashed #d3dec8;
        border-radius: 8px;
        color: var(--muted);
        text-align: center;
        font-size: 12px;
        line-height: 1.8;
      }
      .secondary {
        border: 1px solid var(--line);
        border-radius: 5px;
        background: white;
        color: var(--green);
        padding: 10px 13px;
        font-size: 11px;
      }
      .material-form {
        display: grid;
        gap: 16px;
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
      }
      textarea {
        font: inherit;
        font-size: 12px;
        line-height: 1.8;
        padding: 12px;
        border: 1px solid var(--line);
        border-radius: 5px;
        resize: vertical;
      }
      .actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        border-top: 1px solid var(--line);
        padding-top: 18px;
      }
      .original {
        margin-top: 15px;
        background: #f8faf4;
      }
      .error {
        font-size: 11px;
        color: #ae5545;
      }
      @media (max-width: 600px) {
        .materials-heading {
          align-items: flex-start;
          flex-direction: column;
        }
      }
    `,
  ],
})
export class MaterialsComponent {
  readonly store = inject(ProjectsStore);
  @Input({ required: true }) projectId = "";
  @Input() featureId?: string;
  @Input() materials: Material[] = [];
  readonly adding = signal(false);
  readonly reading = signal<Material | null>(null);
  readonly error = signal("");
  readonly types = MATERIAL_TYPES;
  editingId = "";
  title = "";
  content = "";
  type: MaterialType = "text";
  typeLabel(type: string) {
    return MATERIAL_TYPES.find((t) => t.id === type)?.label ?? type;
  }
  openForm(): void {
    this.editingId = "";
    this.title = "";
    this.content = "";
    this.type = "text";
    this.error.set("");
    this.adding.set(true);
  }
  edit(material: Material): void {
    this.editingId = material.id;
    this.title = material.title;
    this.content = material.content;
    this.type = material.type;
    this.error.set("");
    this.reading.set(null);
    this.adding.set(true);
  }
  save(): void {
    if (this.editingId) {
      if (
        this.store.saveKnowledge(
          { title: this.title, content: this.content, type: this.type },
          this.editingId,
        )
      )
        this.adding.set(false);
      else this.error.set(this.store.error());
      return;
    }
    if (
      this.store.addMaterial(
        this.projectId,
        this.featureId,
        this.title,
        this.content,
        this.type,
      )
    )
      this.adding.set(false);
    else this.error.set(this.store.error());
  }
  async readFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement,
      file = input.files?.[0];
    if (!file) return;
    try {
      if (file.size > 1000000) throw new Error("O documento excede 1 MB.");
      if (!/\.(txt|md|csv|json)$/i.test(file.name))
        throw new Error(
          "Selecione um arquivo TXT, Markdown, CSV ou JSON textual.",
        );
      const text = await file.text();
      if (text.includes("\0"))
        throw new Error("O arquivo não parece ser textual.");
      if (text.length > 200000)
        throw new Error("O texto excede 200 mil caracteres.");
      this.title ||= file.name;
      this.content = text;
      this.type = "document";
      this.error.set("");
    } catch (error) {
      this.error.set(
        error instanceof Error
          ? error.message
          : "Não foi possível ler o arquivo.",
      );
    } finally {
      input.value = "";
    }
  }
}
