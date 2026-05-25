/** Thrown by HTTP middleware (auth, role guards) to short-circuit a request with
 *  a typed HTTP-shaped error. Distinct from DomainError because these are transport-layer
 *  failures (missing bearer, forbidden role), not domain invariants. The central error
 *  middleware has a dedicated branch that maps HttpError to RFC 7807. */
export class HttpError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.code = code;
    this.status = status;
    this.name = new.target.name;
  }
}
