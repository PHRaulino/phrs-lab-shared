import { Injectable, inject } from "@angular/core";
import { HttpClient, HttpContext } from "@angular/common/http";
import { LOCAL_DEMO_REQUEST } from "../backend/backend.interceptor";
import { environment } from "../../../environments/environment";

export interface Overview {
  stats: { label: string; value: string; detail: string }[];
  activity: { title: string; description: string; time: string }[];
}

@Injectable({ providedIn: "root" })
export class OverviewService {
  private readonly http = inject(HttpClient);
  getOverview() {
    return this.http.get<Overview>(`${environment.apiUrl}/overview`, {
      context: new HttpContext().set(LOCAL_DEMO_REQUEST, environment.mocks),
    });
  }
}
