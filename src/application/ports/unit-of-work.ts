export interface UnitOfWork {
  run<T>(fn: () => Promise<T>): Promise<T>;
}
