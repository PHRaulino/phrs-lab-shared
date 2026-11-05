import assert from "node:assert/strict";
import { test } from "node:test";
import { BehaviorSubject, Observable, Subject } from "rxjs";
import {
  BackendDisabledError,
  guardBackendRequest,
} from "../src/app/core/backend/backend-request.guard";
test("backend desabilitado não inicia a operação remota", () => {
  let started = 0;
  let error: unknown;
  guardBackendRequest(new BehaviorSubject(false), () => {
    started++;
    return new Subject();
  }).subscribe({ error: (value) => (error = value) });
  assert.equal(started, 0);
  assert.ok(error instanceof BackendDisabledError);
});
test("desabilitar após progresso cancela a operação e impede respostas antigas", () => {
  const enabled = new BehaviorSubject(true);
  const remote = new Subject<string>();
  const received: string[] = [];
  let stopped = false;
  let failed = false;
  const operation = new Observable<string>((subscriber) => {
    const subscription = remote.subscribe(subscriber);
    return () => {
      stopped = true;
      subscription.unsubscribe();
    };
  });
  guardBackendRequest(enabled, () => operation).subscribe({
    next: (value) => received.push(value),
    error: () => (failed = true),
  });
  remote.next("progresso");
  enabled.next(false);
  enabled.next(true);
  remote.next("resposta antiga");
  assert.equal(stopped, true);
  assert.equal(failed, true);
  assert.deepEqual(received, ["progresso"]);
});
test("a resposta normal é entregue quando o backend permanece habilitado", () => {
  const enabled = new BehaviorSubject(true);
  const remote = new Subject<number>();
  const values: number[] = [];
  guardBackendRequest(enabled, () => remote).subscribe((value) =>
    values.push(value),
  );
  remote.next(10);
  remote.complete();
  assert.deepEqual(values, [10]);
});

test("preferência é restaurada e os três estados do backend são distintos", async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
  try {
    const { BackendModeService } = await import(
      "../src/app/core/backend/backend-mode.service"
    );
    const service = new BackendModeService();
    assert.equal(service.state(), "unavailable");
    service.reportAvailable(true);
    assert.equal(service.state(), "available");
    service.setEnabled(false);
    assert.equal(service.state(), "disabled");
    const restored = new BackendModeService();
    assert.equal(restored.enabled(), false);
    restored.reportAvailable(true);
    assert.equal(restored.state(), "disabled");
    restored.setEnabled(true);
    assert.equal(restored.state(), "unavailable");
  } finally {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
