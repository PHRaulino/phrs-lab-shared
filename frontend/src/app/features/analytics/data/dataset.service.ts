import { Injectable, InjectionToken, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom } from "rxjs";
import {
  DatasetData,
  DatasetDefinition,
  VisualDefinition,
  VisualView,
  ModuleInstance,
  BoundFilter,
  FilterValue,
} from "../models/analytics.models";
import { DATASETS } from "./dataset-catalog";
import { aggregate, joinRows, validateDataset } from "./query-engine";
import { applyFilters, moduleFilters } from "../state/filter-engine";
export interface DatasetAdapter {
  load(definition: DatasetDefinition): Promise<DatasetData>;
}
@Injectable({ providedIn: "root" })
export class JsonDatasetAdapter implements DatasetAdapter {
  private readonly http = inject(HttpClient);
  async load(definition: DatasetDefinition): Promise<DatasetData> {
    return validateDataset(
      await firstValueFrom(this.http.get<unknown>(definition.url)),
      definition,
    );
  }
}
export const DATASET_ADAPTER = new InjectionToken<DatasetAdapter>(
  "DatasetAdapter",
  { providedIn: "root", factory: () => inject(JsonDatasetAdapter) },
);
@Injectable({ providedIn: "root" })
export class DatasetService {
  private readonly adapter = inject(DATASET_ADAPTER);
  private readonly datasets = new Map<string, Promise<DatasetData>>();
  private readonly queries = new Map<string, Promise<VisualView>>();
  load(id: string): Promise<DatasetData> {
    const schema = DATASETS.find((d) => d.id === id);
    if (!schema) return Promise.reject(new Error("Dataset não registrado."));
    let data = this.datasets.get(id);
    if (!data) {
      data = this.adapter.load(schema).catch((error) => {
        this.datasets.delete(id);
        throw error;
      });
      this.datasets.set(id, data);
    }
    return data;
  }
  query(
    module: ModuleInstance,
    visual: VisualDefinition,
    filters: BoundFilter[],
    values: Record<string, FilterValue>,
  ): Promise<VisualView> {
    const relevant = moduleFilters(module.id, filters, values);
    const key = JSON.stringify([
      visual.id,
      visual.version,
      module.configuration,
      relevant,
      filters
        .filter((f) => f.moduleIds.includes(module.id))
        .map((f) => f.bindings[module.id]),
    ]);
    let result = this.queries.get(key);
    if (!result) {
      result = this.load(visual.query.datasetId)
        .then((data) => {
          const schema = DATASETS.find((d) => d.id === visual.query.datasetId)!;
          const rows = applyFilters(
            joinRows(data, schema, visual),
            module.id,
            filters,
            values,
          );
          return aggregate(
            rows,
            visual,
            String(module.configuration["title"] ?? visual.name),
          );
        })
        .catch((error) => {
          this.queries.delete(key);
          throw error;
        });
      if (this.queries.size >= 200)
        this.queries.delete(this.queries.keys().next().value!);
      this.queries.set(key, result);
    }
    return result;
  }
  clear(): void {
    this.datasets.clear();
    this.queries.clear();
  }
}
