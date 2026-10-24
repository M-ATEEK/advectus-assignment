import pino from "pino";
import config from "./index.js";

const transport =
  config.env === "development" ? { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } } : undefined;

export const logger = pino({ level: config.logLevel, transport });
