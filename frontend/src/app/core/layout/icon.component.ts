import { Component, Input } from "@angular/core";

@Component({
  selector: "app-icon",
  standalone: true,
  template: `<svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path [attr.d]="paths[name] || paths['grid']" />
  </svg>`,
  styles: [
    ":host { display: inline-flex; width: 20px; height: 20px; flex-shrink: 0; } svg { width: 100%; height: 100%; }",
  ],
})
export class IconComponent {
  @Input() name = "grid";
  readonly paths: Record<string, string> = {
    chat: "M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-2 2V11.5a9.5 9.5 0 0 1 19 0ZM7 10h10M7 14h6",
    send: "m3 3 18 9-18 9 3-9-3-9Zm3 9h15",
    plus: "M12 5v14M5 12h14",
    copy: "M8 8h12v13H8zM16 8V3H3v13h5",
    stop: "M6 6h12v12H6z",
    menu: "M4 6h16M4 12h16M4 18h16",
    close: "m6 6 12 12M6 18 18 6",
    grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
    sparkles:
      "m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4L12 3ZM20 2v4m-2-2h4M4 18v4m-2-2h4",
    folder: "M3 7V5h6l2 2h10v13H3z",
    arrow: "M5 12h14m-5-5 5 5-5 5",
    check: "m5 12 4 4L19 6",
    layers: "m12 3 10 6-10 6L2 9zM2 13l10 6 10-6M2 17l10 6 10-6",
    code: "m8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 16",
  };
}
