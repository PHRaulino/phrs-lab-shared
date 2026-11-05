import { Component, inject } from "@angular/core";
import { RouterLink } from "@angular/router";
import { BackendModeService } from "../../core/backend/backend-mode.service";
@Component({
  selector: "app-settings",
  standalone: true,
  imports: [RouterLink],
  template: ` <p class="eyebrow">PREFERÊNCIAS DA APLICAÇÃO</p>
    <h1>Configurações.</h1>
    <p class="intro">
      Controle as integrações sem interromper seu trabalho local.
    </p>
    <section>
      <div class="setting-row">
        <div>
          <h2>Utilizar backend</h2>
          <p>Habilite as integrações remotas da aplicação.</p>
        </div>
        <label class="switch"
          ><input
            type="checkbox"
            role="switch"
            aria-label="Utilizar backend"
            [checked]="backend.enabled()"
            (change)="
              backend.setEnabled($any($event.target).checked)
            " /><span></span
        ></label>
      </div>
      <p
        class="backend-state"
        [attr.data-state]="backend.state()"
        role="status"
      >
        ● {{ backend.label() }}
      </p>
      @if (backend.state() === "unavailable") {
        <p class="note">
          Nenhuma integração real foi confirmada. Não há contrato de API
          configurado neste projeto; os dados demonstrativos não indicam
          disponibilidade do backend.
        </p>
      }
      @if (backend.state() === "disabled") {
        <p class="note">
          Chamadas dependentes do backend estão bloqueadas. Analytics e as
          funcionalidades locais continuam disponíveis.
        </p>
      }
      @if (backend.storageError()) {
        <p class="error" role="alert">{{ backend.storageError() }}</p>
      }
    </section>
    <section>
      <h2>O que funciona em cada modo</h2>
      <div class="capability">
        <strong>Analytics</strong>
        <p>
          Dashboards, filtros, layout, importação e exportação usam dados
          locais.
        </p>
        <a routerLink="/analytics">Abrir Analytics →</a>
      </div>
      <div class="capability">
        <strong>Pipelines</strong>
        <p>
          No desenvolvimento, aceita os dados demonstrativos locais. A
          integração real depende de uma API ainda não disponível. A edição de
          YAML continua local.
        </p>
        <a routerLink="/overview">Abrir Pipelines →</a>
      </div>
    </section>`,
  styles: [
    `
      :host {
        display: block;
        max-width: 900px;
        margin: auto;
      }
      h1 {
        font-size: 36px;
        font-weight: 500;
        letter-spacing: -1px;
        margin: 10px 0;
      }
      .intro,
      .note {
        font-size: 13px;
        color: var(--muted);
        line-height: 1.8;
      }
      section {
        border: 1px solid var(--line);
        border-radius: 10px;
        background: #fff;
        padding: 26px;
        margin-top: 24px;
      }
      h2 {
        font-size: 17px;
        font-weight: 550;
        margin: 0 0 9px;
      }
      .setting-row {
        display: flex;
        justify-content: space-between;
        gap: 20px;
        align-items: center;
      }
      .setting-row p,
      .capability p {
        font-size: 12px;
        color: var(--muted);
        line-height: 1.8;
      }
      .switch input {
        position: absolute;
        opacity: 0;
        width: 46px;
        height: 28px;
        cursor: pointer;
      }
      .switch span {
        display: block;
        width: 46px;
        height: 26px;
        background: #c1cbbb;
        border-radius: 18px;
        padding: 3px;
      }
      .switch span::before {
        content: "";
        display: block;
        width: 20px;
        height: 20px;
        background: white;
        border-radius: 50%;
        transition: transform 0.15s;
      }
      .switch input:checked + span {
        background: var(--green);
      }
      .switch input:checked + span::before {
        transform: translateX(20px);
      }
      .switch input:focus-visible + span {
        outline: 2px solid #738c5f;
        outline-offset: 4px;
      }
      .backend-state {
        display: inline-block;
        padding: 8px 12px;
        background: #f4f1e4;
        border-radius: 5px;
        font-size: 12px;
        color: #9a7c35;
      }
      .backend-state[data-state="available"] {
        color: #5c7d47;
        background: #f0f4e9;
      }
      .backend-state[data-state="disabled"] {
        color: #74816e;
        background: #f0f2ec;
      }
      .capability {
        border-top: 1px solid var(--line);
        padding-top: 20px;
        margin-top: 20px;
      }
      .capability strong {
        font-size: 13px;
      }
      .capability a {
        font-size: 12px;
        color: var(--green);
      }
      .error {
        font-size: 12px;
        color: #ae433b;
      }
    `,
  ],
})
export class SettingsComponent {
  readonly backend = inject(BackendModeService);
}
