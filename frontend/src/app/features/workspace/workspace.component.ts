import { Component } from "@angular/core";
import { RouterLink } from "@angular/router";
import { IconComponent } from "../../core/layout/icon.component";

@Component({
  selector: "app-workspace",
  standalone: true,
  imports: [RouterLink, IconComponent],
  template: `<p class="eyebrow">SEU ESPAÇO DE TRABALHO</p>
    <h1>Workspace.</h1>
    <p class="intro">Uma base pronta para o que vem a seguir.</p>
    <section>
      <span class="workspace-icon"><app-icon name="folder" /></span>
      <h2>O próximo projeto começa aqui</h2>
      <p>
        Use este espaço para organizar os módulos e funcionalidades da sua
        aplicação.
      </p>
      <a class="primary-button" routerLink="/overview"
        >Voltar à visão geral <app-icon name="arrow"
      /></a>
    </section>`,
  styles: [
    `
      h1 {
        font-size: 40px;
        font-weight: 500;
        letter-spacing: -1.5px;
        margin: 10px 0;
      }
      .intro {
        color: var(--muted);
        font-size: 14px;
      }
      section {
        border: 1px dashed #cdd5c7;
        border-radius: 12px;
        margin-top: 35px;
        padding: 65px 24px;
        text-align: center;
        background: white;
      }
      .workspace-icon {
        display: inline-grid;
        place-items: center;
        width: 64px;
        height: 64px;
        background: #edf2e7;
        color: #6a8157;
        border-radius: 18px;
      }
      h2 {
        font-size: 22px;
        font-weight: 500;
      }
      section p {
        color: var(--muted);
        font-size: 13px;
        line-height: 1.7;
        margin-bottom: 26px;
      }
    `,
  ],
})
export class WorkspaceComponent {}
