import pino from "pino";

/**
 * Initialize Pino logger with configuration based on environment variables.
 * - Uses LOG_LEVEL from env (defaults to 'info')
 * - Uses pino-pretty for development mode
 * - Logs to file in production mode
 * @returns {pino.Logger} Configured Pino logger instance
 */
function createLogger() {
  const logLevel = process.env.LOG_LEVEL || "info";
  const isDevelopment = process.env.NODE_ENV === "development";

  const config = {
    level: logLevel,
    formatters: {
      level: (label) => ({ level: label.toUpperCase() }),
    },
    redact: ["password", "token", "apiKey"],
  };

  // Development mode: Use pino-pretty for colored console output
  if (isDevelopment) {
    config.transport = {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "HH:MM:ss",
        ignore: "pid,hostname",
        singleLine: false,
      },
    };
  } else {
    // Production mode: Log to file with rotation
    config.transport = {
      target: "pino/file",
      options: {
        destination: "./logs/villager-ai.log",
        mkdir: true,
      },
    };
  }

  return pino(config);
}

const logger = createLogger();

export default logger;
