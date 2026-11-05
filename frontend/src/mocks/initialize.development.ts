import { environment } from "../environments/environment";

export async function enableMocking(): Promise<void> {
  if (!environment.mocks) return;
  const { worker } = await import("./browser");
  await worker.start({
    serviceWorker: { url: "/mockServiceWorker.js" },
    onUnhandledRequest(request, print) {
      if (new URL(request.url).pathname.startsWith("/api/")) print.warning();
    },
  });
}
