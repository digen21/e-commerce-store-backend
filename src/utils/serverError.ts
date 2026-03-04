class ServerError extends Error {
  status: number;
  meta: object;
  constructor({
    message,
    status,
    meta,
  }: {
    message: string;
    status: number;
    meta?: object;
  }) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.meta = meta;

    Error.captureStackTrace(this, this.constructor);
  }
}

export default ServerError;
