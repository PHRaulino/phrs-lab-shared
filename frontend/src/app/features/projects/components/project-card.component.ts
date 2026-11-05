import { Component, EventEmitter, Input, Output } from "@angular/core";
import { DatePipe } from "@angular/common";
import { RouterLink } from "@angular/router";
import { Project, PROJECT_STATUSES } from "../models/projects.models";
@Component({
  selector: "app-project-card",
  standalone: true,
  imports: [DatePipe, RouterLink],
  templateUrl: "./project-card.component.html",
  styleUrl: "./project-card.component.css",
})
export class ProjectCardComponent {
  @Input({ required: true }) project!: Project;
  @Input() featureCount = 0;
  @Input() progress = 0;
  @Output() edited = new EventEmitter<void>();
  @Output() deleted = new EventEmitter<void>();
  projectStatus(value: string) {
    return PROJECT_STATUSES.find((s) => s.id === value)?.label ?? value;
  }
}
