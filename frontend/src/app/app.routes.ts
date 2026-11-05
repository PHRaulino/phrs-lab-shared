import { Routes } from "@angular/router";
import { ShellComponent } from "./core/layout/shell.component";

export const routes: Routes = [
  {
    path: "",
    component: ShellComponent,
    children: [
      { path: "", pathMatch: "full", redirectTo: "overview" },
      {
        path: "overview",
        title: "Visão geral · PHRS Lab",
        loadComponent: () =>
          import("./features/observability/observability.component").then(
            (m) => m.ObservabilityComponent,
          ),
      },
      {
        path: "dependencies",
        data: { graphMode: true },
        title: "Dependências · PHRS Lab",
        loadComponent: () =>
          import("./features/observability/observability.component").then(
            (m) => m.ObservabilityComponent,
          ),
      },
      {
        path: "projects/ai-settings",
        title: "Configurações de IA · PHRS Lab",
        loadComponent: () =>
          import("./features/projects/components/ai-settings.component").then(
            (m) => m.AISettingsComponent,
          ),
      },
      {
        path: "projects/features/:featureId",
        title: "Feature · IARA Analysis",
        loadComponent: () =>
          import("./features/projects/projects.component").then(
            (m) => m.ProjectsComponent,
          ),
      },
      {
        path: "projects/:projectId/features/:featureId",
        title: "Feature · PHRS Lab",
        loadComponent: () =>
          import("./features/projects/projects.component").then(
            (m) => m.ProjectsComponent,
          ),
      },
      {
        path: "projects/:projectId",
        title: "Projeto · PHRS Lab",
        loadComponent: () =>
          import("./features/projects/projects.component").then(
            (m) => m.ProjectsComponent,
          ),
      },
      {
        path: "projects",
        title: "IARA Analysis · PHRS Lab",
        loadComponent: () =>
          import("./features/projects/projects.component").then(
            (m) => m.ProjectsComponent,
          ),
      },
      {
        path: "analytics",
        title: "Analytics · PHRS Lab",
        loadComponent: () =>
          import("./features/analytics/analytics.component").then(
            (m) => m.AnalyticsComponent,
          ),
      },
      {
        path: "chat",
        title: "Chat IA · PHRS Lab",
        loadComponent: () =>
          import("./features/chat/chat.component").then((m) => m.ChatComponent),
      },
      {
        path: "settings",
        title: "Configurações · PHRS Lab",
        loadComponent: () =>
          import("./features/settings/settings.component").then(
            (m) => m.SettingsComponent,
          ),
      },
      {
        path: "workspace",
        title: "Workspace · PHRS Lab",
        loadComponent: () =>
          import("./features/workspace/workspace.component").then(
            (m) => m.WorkspaceComponent,
          ),
      },
      { path: "**", redirectTo: "overview" },
    ],
  },
];
