export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

const LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: "DEBUG",
  [LogLevel.INFO]: "INFO",
  [LogLevel.WARN]: "WARN",
  [LogLevel.ERROR]: "ERROR",
}

function parseLogLevel(env?: string): LogLevel {
  switch (env?.toUpperCase()) {
    case "DEBUG": return LogLevel.DEBUG
    case "INFO": return LogLevel.INFO
    case "WARN": return LogLevel.WARN
    case "ERROR": return LogLevel.ERROR
    default: return LogLevel.INFO
  }
}

export class Logger {
  private level: LogLevel

  constructor(level?: LogLevel) {
    this.level = level ?? parseLogLevel(process.env.LOG_LEVEL)
  }

  setLevel(level: LogLevel): void {
    this.level = level
  }

  private log(level: LogLevel, msg: string, data?: unknown): void {
    if (level < this.level) return

    const timestamp = new Date().toISOString()
    const levelName = LEVEL_NAMES[level]
    const dataStr = data !== undefined ? " " + JSON.stringify(data) : ""
    const line = `[${timestamp}] [${levelName}] ${msg}${dataStr}\n`

    process.stderr.write(line)
  }

  debug(msg: string, data?: unknown): void {
    this.log(LogLevel.DEBUG, msg, data)
  }

  info(msg: string, data?: unknown): void {
    this.log(LogLevel.INFO, msg, data)
  }

  warn(msg: string, data?: unknown): void {
    this.log(LogLevel.WARN, msg, data)
  }

  error(msg: string, data?: unknown): void {
    this.log(LogLevel.ERROR, msg, data)
  }
}

/** Singleton logger instance used across the application */
let _instance: Logger | null = null

export function getLogger(): Logger {
  if (!_instance) {
    _instance = new Logger()
  }
  return _instance
}
