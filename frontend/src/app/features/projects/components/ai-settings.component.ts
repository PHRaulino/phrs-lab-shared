import { Component, effect, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { ANALYSIS_TYPES, AISettings } from "../models/projects.models";
import { ProjectsStore } from "../state/projects.store";
@Component({
  selector: "app-project-ai-settings",
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `<a class="back" routerLink="/projects">← IARA Analysis</a>
    <p class="eyebrow">IARA ANALYSIS · INTELIGÊNCIA ARTIFICIAL</p>
    <h1>Configurações de IA<span>.</span></h1>
    <p class="intro">
      Prepare a integração sem expor credenciais no navegador.
    </p>
    <div class="availability">
      <strong>{{
        store.ready() ? "Provedor disponível" : "IA indisponível"
      }}</strong>
      <p>{{ store.aiReason() }}</p>
    </div>
    @if (store.loading()) {
      <p role="status">Carregando configurações…</p>
    } @else {
      <form (ngSubmit)="save()">
        <label
          >Provedor registrado<select [value]="store.provider.id" disabled>
            <option [value]="store.provider.id">
              {{ store.provider.name }}
            </option>
          </select></label
        >
        <p class="helper">
          O provedor precisa de uma integração segura antes de executar
          análises. Informar um modelo não habilita a execução.
        </p>
        <label
          >Modelo<input
            name="model"
            [(ngModel)]="model"
            maxlength="200"
            placeholder="Será utilizado pelo provedor registrado" /></label
        ><label
          >Tipo de análise padrão<select name="type" [(ngModel)]="type">
            @for (item of types; track item.id) {
              <option [value]="item.id">{{ item.label }}</option>
            }
          </select></label
        ><label
          >Instruções personalizadas<textarea
            name="instructions"
            [(ngModel)]="instructions"
            rows="6"
            maxlength="20000"
          ></textarea></label
        ><label
          >Parâmetros suportados · JSON<textarea
            name="parameters"
            [(ngModel)]="parameters"
            rows="4"
            spellcheck="false"
          ></textarea>
        </label>
        <p class="helper">
          Parâmetros aceitos:
          {{
            Object.keys(store.provider.supportedParameters).join(", ") ||
              "nenhum enquanto o provedor não estiver configurado"
          }}. Não inclua chaves, tokens ou segredos.
        </p>
        <p class="helper">
          Associação ao toggle global:
          {{
            store.provider.usesApplicationBackend
              ? "este provedor depende do backend da aplicação"
              : "independente do backend do orquestrador"
          }}.
        </p>
        @if (error) {
          <p class="error" role="alert">{{ error }}</p>
        }
        <div class="actions">
          <button class="primary-button" type="submit">
            Salvar preferências de IA</button
          ><span role="status">{{ message }}</span>
        </div>
      </form>
    }
    <div class="security-note">
      Nenhum endpoint de IA ou mecanismo de credenciais foi criado. A área de
      Projetos funciona localmente mesmo quando IA ou backend estão
      indisponíveis.
    </div>`,
  styles: [
    `
      :host {
        display: block;
        max-width: 850px;
        margin: auto;
      }
      .back {
        display: inline-block;
        color: var(--muted);
        font-size: 11px;
        margin-bottom: 25px;
        text-decoration: none;
      }
      h1 {
        font-size: 34px;
        letter-spacing: -1px;
        font-weight: 500;
        margin: 10px 0;
      }
      h1 span {
        color: #92a474;
      }
      .intro,
      .helper {
        font-size: 12px;
        line-height: 1.8;
        color: var(--muted);
      }
      .availability,
      .security-note {
        padding: 17px 20px;
        border: 1px solid #e7ddbe;
        border-radius: 7px;
        background: #f7f2e4;
        color: #8c7740;
        margin: 24px 0;
        font-size: 12px;
        line-height: 1.8;
      }
      .availability p {
        margin-bottom: 0;
        font-size: 11px;
      }
      form {
        display: grid;
        gap: 18px;
        background: white;
        border: 1px solid var(--line);
        border-radius: 10px;
        padding: 25px;
      }
      label {
        display: grid;
        gap: 9px;
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
        line-height: 1.8;
        padding: 12px;
        resize: vertical;
        border: 1px solid var(--line);
        border-radius: 5px;
      }
      .helper {
        font-size: 10px;
        margin: 0;
      }
      .actions {
        display: flex;
        align-items: center;
        gap: 15px;
        border-top: 1px solid var(--line);
        padding-top: 20px;
      }
      .actions span {
        font-size: 10px;
        color: #788d60;
      }
      .error {
        font-size: 11px;
        color: #b1644e;
      }
    `,
  ],
})
export class AISettingsComponent {
  readonly store = inject(ProjectsStore);
  readonly types = ANALYSIS_TYPES;
  readonly Object = Object;
  model = this.store.record().settings.model;
  instructions = this.store.record().settings.customInstructions;
  type = this.store.record().settings.defaultType;
  parameters = JSON.stringify(this.store.record().settings.parameters, null, 2);
  error = "";
  message = "";
  private initialized = false;
  constructor() {
    effect(() => {
      if (!this.store.loading() && !this.initialized) {
        const settings = this.store.record().settings;
        this.model = settings.model;
        this.instructions = settings.customInstructions;
        this.type = settings.defaultType;
        this.parameters = JSON.stringify(settings.parameters, null, 2);
        this.initialized = true;
      }
    });
  }
  save(): void {
    try {
      const parameters = JSON.parse(this.parameters);
      if (
        !parameters ||
        typeof parameters !== "object" ||
        Array.isArray(parameters)
      )
        throw new Error("Informe um objeto JSON para os parâmetros.");
      const settings: AISettings = {
        schemaVersion: 1,
        providerId: this.store.provider.id,
        model: this.model,
        defaultType: this.type,
        customInstructions: this.instructions,
        parameters,
      };
      if (this.store.saveSettings(settings)) {
        this.message = "Preferências salvas neste navegador.";
        this.error = "";
      } else this.error = this.store.error();
    } catch (error) {
      this.error =
        error instanceof Error ? error.message : "Configurações inválidas.";
    }
  }
}
