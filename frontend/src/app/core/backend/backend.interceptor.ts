import {
  HttpContextToken,
  HttpErrorResponse,
  HttpResponse,
  HttpInterceptorFn,
} from "@angular/common/http";
import { inject } from "@angular/core";
import { tap } from "rxjs";
import { guardBackendRequest } from "./backend-request.guard";
import { BackendModeService } from "./backend-mode.service";
/** Set on future remote adapters whose URL is outside /api. */
export const USES_BACKEND = new HttpContextToken<boolean>(() => false);
/** The existing MSW endpoint is demonstrative and does not prove backend availability. */
export const LOCAL_DEMO_REQUEST = new HttpContextToken<boolean>(() => false);
export const backendInterceptor: HttpInterceptorFn = (request, next) => {
  const backend = inject(BackendModeService);
  const url = new URL(request.url, document.baseURI);
  const dependent =
    request.context.get(USES_BACKEND) ||
    (url.origin === location.origin && url.pathname.startsWith("/api/"));
  if (!dependent) return next(request);
  return guardBackendRequest(backend.changes, () => next(request)).pipe(
    tap({
      next: (event) => {
        if (
          event instanceof HttpResponse &&
          !request.context.get(LOCAL_DEMO_REQUEST)
        )
          backend.reportAvailable(true);
      },
      error: (error: unknown) => {
        if (
          !request.context.get(LOCAL_DEMO_REQUEST) &&
          error instanceof HttpErrorResponse &&
          (error.status === 0 || error.status >= 500)
        )
          backend.reportAvailable(false);
      },
    }),
  );
};
