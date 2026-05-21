import type { UnitOfWork } from "@/application/ports/unit-of-work.js";

/** Pass-through UoW; in unit tests we just execute the callback directly. */
export class FakeUnitOfWork implements UnitOfWork {
  async run<T>(fn: () => Promise<T>): Promise<T> {
    return fn();
  }
}
