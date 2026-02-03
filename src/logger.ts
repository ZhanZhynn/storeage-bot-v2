import pino from "pino";
const level = "info";

export const logger = pino({
  level,
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "SYS:yyyy-mm-dd HH:MM:ss.l",
      ignore: "pid,hostname",
    },
  },
});

export const log = {
  info: (msg: string, data?: Record<string, unknown>) => logger.info(data, msg),
  error: (msg: string, data?: Record<string, unknown>) => logger.error(data, msg),
  warn: (msg: string, data?: Record<string, unknown>) => logger.warn(data, msg),
  debug: (msg: string, data?: Record<string, unknown>) => logger.debug(data, msg),
};
