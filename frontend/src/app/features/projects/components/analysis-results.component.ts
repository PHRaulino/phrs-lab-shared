import { Component, Input, OnChanges, signal } from "@angular/core";
import { DatePipe, JsonPipe } from "@angular/common";
import { AnalysisRun } from "../models/projects.models";
import { analysisMarkdown, compareAnalyses } from "../data/context-engine";
@Component({
  selector: "app-analysis-results",
  standalone: true,
  imports: [DatePipe, JsonPipe],
  template: `<div class="result-header">
      <div>
        <p class="eyebrow">RESULTADO PRESERVADO · V{{ run.version }}</p>
        <h3>{{ run.type }} · {{ run.createdAt | date: "dd/MM/yyyy HH:mm" }}</h3>
        <small>{{ run.providerId }} / {{ run.model }}</small>
      </div>
      <div class="result-actions">
        <button (click)="copy()">
          {{ copied() ? "✓ Copiado" : "Copiar Markdown" }}</button
        ><button (click)="export('md')">Exportar MD</button
        ><button (click)="export('json')">Exportar JSON</button>
      </div>
    </div>
    <p class="summary">{{ run.result.summary }}</p>
    @for (
      evaluation of run.result.evaluations ?? [];
      track evaluation.featureId
    ) {
      <section>
        <h4>{{ evaluationQuestion(evaluation.featureId) }}</h4>
        <p class="summary">{{ evaluation.answer }}</p>
        @for (quote of evaluation.evidence; track $index) {
          <blockquote>{{ quote }}</blockquote>
        }
        @if (!evaluation.evidence.length) {
          <p class="meta">
            Nenhum trecho de evidência informado para esta resposta.
          </p>
        }
      </section>
    }
    @for (section of run.result.sections; track section.id) {
      <section>
        <h4>{{ section.title }}</h4>
        @for (item of section.items; track $index) {
          <div class="result-item" [attr.data-origin]="item.origin">
            <span>{{
              item.origin === "provided"
                ? "Informação fornecida"
                : item.origin === "hypothesis"
                  ? "Hipótese · não confirmada"
                  : "Sugestão · não aprovada"
            }}</span>
            <p>{{ item.text }}</p>
            @if (item.sourceMaterialIds.length) {
              <small>Fontes: {{ sourceNames(item.sourceMaterialIds) }}</small>
            }
            @if (item.sourceContext) {
              <small
                >Fonte:
                {{
                  item.sourceContext === "transcript"
                    ? "transcrição do atendimento"
                    : item.sourceContext === "project"
                      ? "contexto do projeto"
                      : item.sourceContext === "feature"
                        ? "contexto da feature"
                        : "requisitos selecionados"
                }}</small
              >
            }
          </div>
        }
      </section>
    }
    @if (run.result.openQuestions.length) {
      <section>
        <h4>Questões em aberto</h4>
        <ul>
          @for (question of run.result.openQuestions; track $index) {
            <li>{{ question }}</li>
          }
        </ul>
      </section>
    }
    <details>
      <summary>Contexto e instruções desta versão</summary>
      <p class="instruction">
        {{ run.instruction || "Sem instrução adicional." }}
      </p>
      <p class="meta">
        Instruções personalizadas: {{ run.settings.customInstructions }}
      </p>
      <p class="meta">
        {{ run.context.materials.length }} materiais ·
        {{ run.context.requirements.length }} requisitos ·
        {{
          run.context.project
            ? "Contexto do projeto incluído"
            : "Contexto do projeto não incluído"
        }}
      </p>
    </details>
    <details>
      <summary>Consultar cópia do contexto utilizado</summary>
      <pre class="source-context">{{ run.context | json }}</pre>
    </details>
    @if (comparison) {
      <section class="comparison">
        <h4>Comparação: v{{ comparison.version }} → v{{ run.version }}</h4>
        @if (difference(); as diff) {
          <p>{{ diff.unchanged.length }} trechos mantidos</p>
          @for (text of diff.added; track $index) {
            <p class="added">+ {{ text }}</p>
          }
          @for (text of diff.removed; track $index) {
            <p class="removed">− {{ text }}</p>
          }
        }
      </section>
    }
    @if (error()) {
      <p class="result-error" role="alert">{{ error() }}</p>
    }`,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }
      .result-header {
        display: flex;
        justify-content: space-between;
        gap: 15px;
        flex-wrap: wrap;
      }
      h3 {
        font-size: 17px;
        font-weight: 550;
        margin: 10px 0;
      }
      small {
        font-size: 10px;
        color: var(--muted);
      }
      .result-actions {
        display: flex;
        gap: 7px;
        align-items: flex-start;
        flex-wrap: wrap;
      }
      button {
        font-size: 10px;
        border: 1px solid var(--line);
        border-radius: 5px;
        background: white;
        color: var(--green);
        padding: 9px 10px;
      }
      .summary {
        font-size: 13px;
        line-height: 1.9;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
      section {
        border-top: 1px solid var(--line);
        margin-top: 24px;
        padding-top: 8px;
      }
      h4 {
        font-size: 13px;
        font-weight: 600;
      }
      .result-item {
        background: #f7f9f3;
        border: 1px solid var(--line);
        border-radius: 7px;
        padding: 13px;
        margin-top: 10px;
      }
      .result-item > span {
        font-size: 9px;
        font-weight: 600;
        color: #71885c;
      }
      .result-item[data-origin="hypothesis"] > span {
        color: #a18440;
      }
      .result-item[data-origin="suggestion"] > span {
        color: #5a8393;
      }
      .result-item p,
      li {
        font-size: 12px;
        line-height: 1.8;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
      .result-item p {
        margin: 7px 0;
      }
      summary {
        cursor: pointer;
        font-size: 11px;
        color: var(--muted);
      }
      details {
        margin-top: 24px;
        border-top: 1px solid var(--line);
        padding-top: 18px;
      }
      .instruction,
      .meta {
        font-size: 11px;
        color: var(--muted);
        line-height: 1.8;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
      .comparison p {
        font-size: 11px;
        line-height: 1.8;
      }
      .added {
        background: #edf5e7;
        padding: 8px;
        color: #577b42;
      }
      .removed {
        background: #fff0ec;
        padding: 8px;
        color: #b06854;
      }
      .source-context {
        font: 10px/1.8 monospace;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        max-height: 400px;
        overflow: auto;
        background: #f7f9f3;
        padding: 14px;
        border-radius: 6px;
      }
      .result-error {
        font-size: 11px;
        color: #b3644f;
      }
    `,
  ],
})
export class AnalysisResultsComponent implements OnChanges {
  evaluationQuestion(id: string): string {
    return (
      this.run.context.evaluationQuestions?.find((q) => q.featureId === id)
        ?.question ?? id
    );
  }
  ngOnChanges(): void {
    this.copied.set(false);
    this.error.set("");
  }
  @Input({ required: true }) run!: AnalysisRun;
  @Input() comparison: AnalysisRun | null = null;
  readonly copied = signal(false);
  readonly error = signal("");
  sourceNames(ids: string[]) {
    return ids
      .map(
        (id) =>
          this.run.context.materials.find((m) => m.id === id)?.title ?? id,
      )
      .join(", ");
  }
  difference() {
    try {
      return this.comparison
        ? compareAnalyses(this.comparison, this.run)
        : null;
    } catch (error) {
      return null;
    }
  }
  async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(analysisMarkdown(this.run));
      this.copied.set(true);
      this.error.set("");
    } catch {
      this.error.set(
        "Não foi possível copiar automaticamente. Use a exportação Markdown.",
      );
    }
  }
  export(type: "md" | "json"): void {
    const content =
      type === "md"
        ? analysisMarkdown(this.run)
        : JSON.stringify(this.run, null, 2);
    const url = URL.createObjectURL(
      new Blob([content], {
        type:
          type === "md" ? "text/markdown;charset=utf-8" : "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `analise-${this.run.id}-v${this.run.version}.${type}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
