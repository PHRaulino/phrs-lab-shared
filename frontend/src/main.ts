import { bootstrapApplication } from "@angular/platform-browser";
import { AppComponent } from "./app/app.component";
import { appConfig } from "./app/app.config";
import { enableMocking } from "./mocks/initialize";

async function bootstrap(): Promise<void> {
  await enableMocking();
  await bootstrapApplication(AppComponent, appConfig);
}

bootstrap().catch((error: unknown) =>
  console.error("Não foi possível iniciar a aplicação.", error),
);
