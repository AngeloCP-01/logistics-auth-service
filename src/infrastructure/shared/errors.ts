/** Thrown by infrastructure adapters when an external system returns a contract-violating
 *  response (e.g., Redis pipeline returns null, RabbitMQ channel missing). Distinct from
 *  DomainError because these aren't business rules. The central error middleware maps
 *  them to a generic 500 without exposing internals. */
export class InfrastructureError extends Error {
  readonly code: string;
  readonly status = 500;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = new.target.name;
  }
}
