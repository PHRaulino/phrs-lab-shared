import { Injectable, InjectionToken, inject } from "@angular/core";
import { environment } from "../../../../environments/environment";
/** Replace with the existing trusted identity/claims adapter when authentication becomes available. */
export interface AnalyticsAccess {
  subject: string;
  canComposeOfficial: boolean;
  demonstration: boolean;
}
export const ANALYTICS_ACCESS = new InjectionToken<AnalyticsAccess>(
  "AnalyticsAccess",
  {
    providedIn: "root",
    factory: () => ({
      subject: "browser-profile",
      canComposeOfficial: !environment.production,
      demonstration: true,
    }),
  },
);
@Injectable({ providedIn: "root" })
export class AnalyticsPolicy {
  readonly access = inject(ANALYTICS_ACCESS);
  readonly internal = this.access.canComposeOfficial;
  readonly ownerId = this.access.subject;
}
