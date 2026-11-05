import { Injectable } from "@angular/core";
import { ProjectsRecord } from "../models/projects.models";
@Injectable({ providedIn: "root" })
export class ProjectsRepository {
  private database?: Promise<IDBDatabase>;
  private queue: Promise<void> = Promise.resolve();
  private open(): Promise<IDBDatabase> {
    return (this.database ??= new Promise((resolve, reject) => {
      const request = indexedDB.open("phrs-projects", 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("profiles"))
          db.createObjectStore("profiles", { keyPath: "ownerId" });
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => {
          request.result.close();
          this.database = undefined;
        };
        resolve(request.result);
      };
      request.onerror = () => {
        this.database = undefined;
        reject(
          new Error(
            "Não foi possível abrir o IndexedDB. As alterações não serão persistidas.",
          ),
        );
      };
      request.onblocked = () =>
        reject(
          new Error(
            "Feche outras abas antigas da aplicação para atualizar o armazenamento.",
          ),
        );
    }));
  }
  async load(ownerId: string): Promise<ProjectsRecord | null> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const request = db
        .transaction("profiles")
        .objectStore("profiles")
        .get(ownerId);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () =>
        reject(new Error("Não foi possível ler suas projetos."));
    });
  }
  save(record: ProjectsRecord): Promise<void> {
    const copy = structuredClone(record);
    const operation = this.queue
      .catch(() => undefined)
      .then(async () => {
        const db = await this.open();
        return new Promise<void>((resolve, reject) => {
          const transaction = db.transaction("profiles", "readwrite");
          transaction.objectStore("profiles").put(copy);
          transaction.oncomplete = () => resolve();
          transaction.onerror = transaction.onabort = () =>
            reject(
              new Error(
                "Não foi possível salvar no IndexedDB. Exporte sua definição para preservar as alterações.",
              ),
            );
        });
      });
    this.queue = operation;
    return operation;
  }
}
