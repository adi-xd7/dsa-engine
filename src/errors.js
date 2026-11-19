export class E3Error extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "E3Error";
    this.code = code;
    this.details = details;
  }
}
