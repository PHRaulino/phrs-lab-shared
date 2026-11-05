import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Task } from "../models/observability.models";
import { generateTaskYaml } from "../data/task-yaml-export";
import {
  ConfigurationField,
  configurationFields,
  parseConfiguration,
} from "../models/task-configuration-form";
@Component({
  selector: "app-task-editor",
  standalone: true,
  imports: [FormsModule],
  templateUrl: "./task-editor.component.html",
  styleUrl: "./task-editor.component.css",
})
export class TaskEditorComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input({ required: true }) task!: Task;
  @Output() dismissed = new EventEmitter<void>();
  @ViewChild("dialog") dialog!: ElementRef<HTMLDialogElement>;
  fields: ConfigurationField[] = [];
  errors: Record<string, string> = {};
  exportError = "";
  generatedYaml = "";
  copied = false;
  copyError = "";
  submitted = false;
  ngOnInit(): void {
    this.fields = configurationFields(this.task.configuration);
  }
  ngAfterViewInit(): void {
    this.dialog.nativeElement.showModal();
  }
  ngOnDestroy(): void {
    this.dialog.nativeElement.close();
  }
  save(): void {
    if (this.generatedYaml) return;
    this.submitted = true;
    const result = parseConfiguration(this.fields);
    this.errors = result.errors;
    if (!result.valid) {
      queueMicrotask(() =>
        this.dialog.nativeElement
          .querySelector<HTMLElement>('[aria-invalid="true"]')
          ?.focus(),
      );
      return;
    }
    try {
      this.generatedYaml = generateTaskYaml(result.configuration);
      queueMicrotask(() => {
        const body =
          this.dialog.nativeElement.querySelector<HTMLElement>(".editor-body");
        if (body) body.scrollTop = 0;
        this.dialog.nativeElement
          .querySelector<HTMLTextAreaElement>(".yaml-preview")
          ?.focus();
      });
    } catch {
      this.exportError =
        "Não foi possível gerar o YAML. Confira os valores e tente novamente.";
      return;
    }
  }
  async copyYaml(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.generatedYaml);
      this.copied = true;
      this.copyError = "";
    } catch {
      const preview =
        this.dialog.nativeElement.querySelector<HTMLTextAreaElement>(
          ".yaml-preview",
        );
      preview?.focus();
      preview?.select();
      this.copyError =
        "Não foi possível copiar automaticamente. O conteúdo foi selecionado para você copiar manualmente.";
    }
  }
  backToForm(): void {
    this.generatedYaml = "";
    this.copied = false;
    this.copyError = "";
  }
  changed(): void {
    this.exportError = "";
    if (this.submitted) this.errors = parseConfiguration(this.fields).errors;
  }
  close(event?: Event): void {
    event?.preventDefault();
    this.dialog.nativeElement.close();
    this.dismissed.emit();
  }
}
