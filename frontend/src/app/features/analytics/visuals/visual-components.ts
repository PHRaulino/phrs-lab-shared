import { Component, Input } from "@angular/core";

import { VisualView } from "../models/analytics.models";
const LABELS: Record<string, string> = {
  completed: "Concluída",
  error: "Erro",
  running: "Em execução",
  waiting: "Aguardando",
  execution_id: "Execução",
  execution_date: "Data",
  "unit.name": "Unidade",
  status: "Status",
  layer: "Camada",
};
export function label(value: string): string {
  return LABELS[value] ?? value;
}
@Component({
  selector: "app-analytics-kpi",
  standalone: true,
  template: `<div class="kpi">
    <span class="kpi-accent">↗</span
    ><strong
      >{{ view.unit === "R$" ? "R$ " : "" }}{{ format(view.value ?? 0)
      }}<small>{{ view.unit !== "R$" ? view.unit : "" }}</small></strong
    >
    <p>NO PERÍODO SELECIONADO</p>
  </div>`,
  styles: [
    `
      .kpi {
        padding: 0 4px;
        position: relative;
      }
      .kpi strong {
        font-size: clamp(24px, 3vw, 30px);
        font-weight: 500;
        letter-spacing: -1px;
        line-height: 1.2;
        display: block;
      }
      .kpi small {
        font-size: 12px;
        letter-spacing: 0;
        margin-left: 6px;
        color: var(--muted);
      }
      .kpi p {
        font-size: 8px;
        letter-spacing: 1px;
        color: #8b977d;
        margin: 5px 0;
      }
      .kpi-accent {
        position: absolute;
        right: 0;
        top: 7px;
        color: #93a674;
        font-size: 20px;
      }
    `,
  ],
})
export class KpiVisual {
  readonly format = (value: number) =>
    new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value);
  @Input({ required: true }) view!: VisualView;
}
@Component({
  selector: "app-analytics-bars",
  standalone: true,
  template: `<div class="bars">
    @for (name of view.labels; track name; let i = $index) {
      <div class="bar-row">
        <div>
          <span>{{ label(name) }}</span
          ><strong>{{ format(view.values[i]) }}</strong>
        </div>
        <div class="bar-track">
          <span
            [style.width.%]="(view.values[i] / max) * 100"
            [style.background]="colors[i % colors.length]"
          ></span>
        </div>
      </div>
    }
  </div>`,
  styles: [
    `
      .bars {
        padding: 8px 0;
        display: grid;
        gap: 18px;
      }
      .bar-row > div:first-child {
        display: flex;
        justify-content: space-between;
        font-size: 10px;
        margin-bottom: 8px;
      }
      .bar-row strong {
        font-weight: 500;
      }
      .bar-track {
        height: 12px;
        background: #f1f4eb;
        border-radius: 3px;
        overflow: hidden;
      }
      .bar-track span {
        display: block;
        height: 100%;
        border-radius: 3px;
      }
    `,
  ],
})
export class BarVisual {
  readonly format = (value: number) =>
    new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(value);
  @Input({ required: true }) view!: VisualView;
  readonly label = label;
  readonly colors = ["#809c66", "#bd7664", "#447d79", "#c0aa6b"];
  get max() {
    return Math.max(1, ...this.view.values);
  }
}
@Component({
  selector: "app-analytics-line",
  standalone: true,
  template: `<div class="line-chart">
    <svg
      viewBox="0 0 440 175"
      role="img"
      [attr.aria-label]="view.title + ' — ' + view.values.length + ' pontos'"
    >
      @for (y of [20, 60, 100, 140]; track y) {
        <line
          x1="18"
          x2="420"
          [attr.y1]="y"
          [attr.y2]="y"
          stroke="#e9eddf"
          stroke-dasharray="3 4"
        />
      }
      <polygon [attr.points]="'20,145 ' + points + ' 420,145'" fill="#eaf0dc" />
      <polyline
        [attr.points]="points"
        fill="none"
        stroke="#7d9961"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <text x="20" y="169">{{ view.labels[0] }}</text>
      <text x="420" y="169" text-anchor="end">
        {{ view.labels[view.labels.length - 1] }}
      </text>
    </svg>
    <p>Menor: {{ min }} · Maior: {{ max }}</p>
  </div>`,
  styles: [
    `
      .line-chart {
        height: 100%;
        display: grid;
        align-content: center;
      }
      svg {
        width: 100%;
        max-height: 210px;
      }
      text {
        font: 9px sans-serif;
        fill: #849174;
      }
      .line-chart p {
        font-size: 9px;
        color: var(--muted);
        text-align: right;
        margin: 5px 0;
      }
    `,
  ],
})
export class LineVisual {
  @Input({ required: true }) view!: VisualView;
  get max() {
    return Math.max(1, ...this.view.values);
  }
  get min() {
    return Math.min(...this.view.values);
  }
  get points() {
    return this.view.values
      .map(
        (v, i) =>
          `${20 + (i * 400) / Math.max(1, this.view.values.length - 1)},${145 - (v / this.max) * 125}`,
      )
      .join(" ");
  }
}
@Component({
  selector: "app-analytics-donut",
  standalone: true,
  template: `<div class="donut">
    <svg viewBox="0 0 180 180" role="img" [attr.aria-label]="view.title">
      <circle
        cx="90"
        cy="90"
        r="60"
        fill="none"
        stroke="#f0f2e9"
        stroke-width="22"
      />
      @for (value of view.values; track i; let i = $index) {
        <circle
          cx="90"
          cy="90"
          r="60"
          fill="none"
          [attr.stroke]="colors[i % colors.length]"
          stroke-width="22"
          [attr.stroke-dasharray]="(value / Math.max(1, total)) * 377 + ' 377'"
          [attr.stroke-dashoffset]="offset(i)"
          transform="rotate(-90 90 90)"
        />
      }
      <text x="90" y="88" text-anchor="middle" class="donut-total">
        {{ total }}
      </text>
      <text x="90" y="108" text-anchor="middle">REGISTROS</text>
    </svg>
    <div class="donut-labels">
      @for (name of view.labels; track name; let i = $index) {
        <span
          ><i [style.background]="colors[i % colors.length]"></i>{{ name }}
          <strong>{{ view.values[i] }}</strong></span
        >
      }
    </div>
  </div>`,
  styles: [
    `
      .donut {
        display: grid;
        grid-template-columns: minmax(110px, 180px) 1fr;
        align-items: center;
        gap: 15px;
        height: 100%;
      }
      svg {
        width: 100%;
      }
      text {
        font: 8px sans-serif;
        fill: #859175;
      }
      .donut-total {
        font-size: 29px;
        fill: #30472e;
      }
      .donut-labels {
        display: grid;
        gap: 12px;
      }
      .donut-labels span {
        display: flex;
        align-items: center;
        gap: 7px;
        font-size: 10px;
      }
      .donut-labels i {
        display: inline-block;
        width: 6px;
        height: 6px;
        border-radius: 50%;
      }
      .donut-labels strong {
        margin-left: auto;
        font-weight: 500;
      }
      @media (max-width: 600px) {
        .donut {
          grid-template-columns: 120px 1fr;
        }
      }
    `,
  ],
})
export class DonutVisual {
  @Input({ required: true }) view!: VisualView;
  readonly Math = Math;
  readonly colors = ["#789560", "#b5c397", "#d4bd7b", "#759b99"];
  get total() {
    return this.view.values.reduce((a, b) => a + b, 0);
  }
  offset(i: number) {
    return (
      (-this.view.values.slice(0, i).reduce((a, b) => a + b, 0) /
        Math.max(1, this.total)) *
      377
    );
  }
}
@Component({
  selector: "app-analytics-table",
  standalone: true,
  template: `<div class="data-table">
    <table>
      <thead>
        <tr>
          @for (field of view.fields; track field) {
            <th>{{ label(field) }}</th>
          }
        </tr>
      </thead>
      <tbody>
        @for (row of view.rows; track $index) {
          <tr>
            @for (field of view.fields; track field) {
              <td [attr.data-value]="row[field]">
                {{ label("" + (row[field] ?? "—")) }}
              </td>
            }
          </tr>
        }
      </tbody>
    </table>
  </div>`,
  styles: [
    `
      .data-table {
        height: 100%;
        max-height: 250px;
        overflow: auto;
        scrollbar-width: thin;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        white-space: nowrap;
        font-size: 10px;
      }
      th {
        text-align: left;
        font-weight: 500;
        color: var(--muted);
        background: #f7f9f3;
        position: sticky;
        top: 0;
      }
      td,
      th {
        padding: 10px;
        border-bottom: 1px solid var(--line);
      }
      td[data-value="error"] {
        color: #b05242;
      }
      td[data-value="completed"] {
        color: #5a7d45;
      }
    `,
  ],
})
export class TableVisual {
  @Input({ required: true }) view!: VisualView;
  readonly label = label;
}
