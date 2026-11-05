import {
  Observable,
  defer,
  filter,
  mergeMap,
  switchMap,
  take,
  takeUntil,
  throwError,
} from "rxjs";
export class BackendDisabledError extends Error {
  constructor() {
    super("Backend desabilitado. Reative a integração em Configurações.");
  }
}
/** Keep listening after progress events so disabling also cancels an in-flight response. */
export function guardBackendRequest<T>(
  enabled: Observable<boolean>,
  start: () => Observable<T>,
): Observable<T> {
  return defer(() =>
    enabled.pipe(
      take(1),
      switchMap((active) => {
        if (!active) return throwError(() => new BackendDisabledError());
        return start().pipe(
          takeUntil(
            enabled.pipe(
              filter((value) => !value),
              take(1),
              mergeMap(() => throwError(() => new BackendDisabledError())),
            ),
          ),
        );
      }),
    ),
  );
}
