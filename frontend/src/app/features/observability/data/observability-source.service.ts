import { Injectable, inject } from "@angular/core";
import { HttpClient, HttpContext } from "@angular/common/http";
import { map, throwError, switchMap, take, distinctUntilChanged } from "rxjs";
import { environment } from "../../../../environments/environment";
import {
  BackendDisabledError,
  BackendModeService,
} from "../../../core/backend/backend-mode.service";
import { LOCAL_DEMO_REQUEST } from "../../../core/backend/backend.interceptor";
import { ObservationSnapshot } from "../models/observability.models";

@Injectable({ providedIn: "root" })
export class ObservabilitySource {
  private readonly http = inject(HttpClient);
  private readonly backend = inject(BackendModeService);
  readonly isDemo = environment.mocks;
  /** Somente o endpoint de exemplo já existente no MSW. Nenhuma API real presumida. */
  read(scenario: "standard" | "large") {
    return this.backend.changes.pipe(
      distinctUntilChanged(),
      switchMap((enabled) => {
        if (!enabled)
          return this.isDemo
            ? this.http.get<ObservationSnapshot>(
                `assets/demo/pipelines-${scenario}.json`,
              )
            : throwError(() => new BackendDisabledError());
        if (!this.isDemo)
          return throwError(
            () =>
              new Error(
                "Integração indisponível. O contrato e a API de observabilidade do orquestrador ainda precisam ser fornecidos. Use o ambiente de desenvolvimento para explorar a demonstração.",
              ),
          );
        return this.http
          .get<{
            observability: ObservationSnapshot;
          }>(`${environment.apiUrl}/overview`, {
            params: { observability: scenario },
            context: new HttpContext().set(LOCAL_DEMO_REQUEST, true),
          })
          .pipe(
            map((response) => {
              if (
                response.observability?.source !== "demo" ||
                !Array.isArray(response.observability.tasks)
              )
                throw new Error("Resposta demonstrativa inválida.");
              return response.observability;
            }),
          );
      }),
      take(1),
    );
  }
}
