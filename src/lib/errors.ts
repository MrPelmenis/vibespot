/**
 * A small typed error the API routes use to return a specific HTTP status with a
 * readable message. Anything not thrown as an HttpError is treated as a 500.
 */
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}
