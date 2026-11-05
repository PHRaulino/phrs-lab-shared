import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  ViewChild,
} from "@angular/core";
@Component({
  selector: "app-analytics-modal",
  standalone: true,
  template: `<dialog
    #dialog
    aria-modal="true"
    [attr.aria-label]="title"
    (cancel)="cancel($event)"
  >
    <header>
      <div>
        <p class="eyebrow">ANALYTICS</p>
        <h2>{{ title }}</h2>
      </div>
      <button
        class="icon-button"
        type="button"
        (click)="dismissed.emit()"
        aria-label="Fechar janela"
      >
        ×
      </button>
    </header>
    <div class="modal-content"><ng-content /></div>
  </dialog>`,
  styles: [
    `
      dialog {
        width: min(670px, calc(100vw - 32px));
        max-height: calc(100dvh - 40px);
        padding: 0;
        border: 1px solid #d9e1d1;
        border-radius: 12px;
        color: var(--ink);
        background: #fff;
        box-shadow: 0 24px 90px #14251c40;
      }
      dialog::backdrop {
        background: #172b2180;
        backdrop-filter: blur(3px);
      }
      header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 15px;
        border-bottom: 1px solid var(--line);
        padding: 24px;
      }
      h2 {
        font-size: 22px;
        font-weight: 500;
        margin: 7px 0 0;
      }
      .modal-content {
        padding: 22px 24px;
        max-height: calc(100dvh - 170px);
        overflow: auto;
        overscroll-behavior: contain;
      }
    `,
  ],
})
export class AnalyticsModalComponent implements AfterViewInit, OnDestroy {
  @Input() title = "";
  @Output() dismissed = new EventEmitter<void>();
  @ViewChild("dialog") dialog!: ElementRef<HTMLDialogElement>;
  ngAfterViewInit(): void {
    this.dialog.nativeElement.showModal();
  }
  ngOnDestroy(): void {
    this.dialog.nativeElement.close();
  }
  cancel(event: Event): void {
    event.preventDefault();
    this.dismissed.emit();
  }
}
