import { http, HttpResponse } from "msw";
import { overviewFixture } from "../fixtures/overview";
import { observationFixture } from "../fixtures/observability";

// Relógio e evolução somente da demonstração; não representam um backend.
const startedAt = Date.now();
export const overviewHandlers = [
  http.get("*/api/overview", ({ request }) => {
    const scenario = new URL(request.url).searchParams.get("observability");
    if (!scenario) return HttpResponse.json(overviewFixture);
    const tick = Math.floor((Date.now() - startedAt) / 15000);
    return HttpResponse.json({
      ...overviewFixture,
      observability: observationFixture(scenario === "large", tick),
    });
  }),
];
