export class RuntimeKernelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuntimeKernelError";
  }
}

export class MissingBotRuntimeError extends RuntimeKernelError {
  constructor(botKeyId: string) {
    super(`Missing BotRuntime for key '${botKeyId}'`);
    this.name = "MissingBotRuntimeError";
  }
}
