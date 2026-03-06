export class CustodianDataNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CustodianDataNotFoundError";
  }
}

export class CustodianApiError extends Error {
  constructor(message: string, public readonly statusCode?: number) {
    super(message);
    this.name = "CustodianApiError";
  }
}

export class OnchainReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OnchainReadError";
  }
}

export class LLMGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LLMGenerationError";
  }
}

export class IPFSUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IPFSUploadError";
  }
}

export class ChainWriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChainWriteError";
  }
}

export class WorkflowTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkflowTimeoutError";
  }
}
