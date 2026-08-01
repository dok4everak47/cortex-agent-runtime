import { describe, it, mock, afterEach } from "node:test"
import assert from "node:assert"
import { Logger, LogLevel } from "../core/logger.js"

// Capture stderr writes for assertions
function captureStderr() {
  const writes: string[] = []
  const mockWrite = mock.fn((chunk: string) => { writes.push(chunk) })
  mock.method(process.stderr, "write", mockWrite)
  return { writes, mockWrite, restore: () => mockWrite.mock.restore() }
}

afterEach(() => {
  // Restore any leftover stderr mocks between tests
  try { mock.restoreAll() } catch { /* ignore */ }
})

describe("Logger — LogLevel enum", () => {
  it("defines levels in order", () => {
    assert.equal(LogLevel.DEBUG, 0)
    assert.equal(LogLevel.INFO, 1)
    assert.equal(LogLevel.WARN, 2)
    assert.equal(LogLevel.ERROR, 3)
  })
})

describe("Logger — level filtering", () => {
  it("filters messages below the set level", () => {
    const { writes, mockWrite, restore } = captureStderr()
    const logger = new Logger(LogLevel.WARN)

    logger.debug("should not appear")
    logger.info("should not appear")
    logger.warn("warning message")
    logger.error("error message")

    assert.equal(mockWrite.mock.callCount(), 2)
    assert.ok(writes[0].includes("WARN"))
    assert.ok(writes[0].includes("warning message"))
    assert.ok(writes[1].includes("ERROR"))
    assert.ok(writes[1].includes("error message"))
    restore()
  })

  it("DEBUG level allows all messages", () => {
    const { mockWrite, restore } = captureStderr()
    const logger = new Logger(LogLevel.DEBUG)

    logger.debug("debug")
    logger.info("info")
    logger.warn("warn")
    logger.error("error")

    assert.equal(mockWrite.mock.callCount(), 4)
    restore()
  })
})

describe("Logger — data serialization", () => {
  it("includes JSON data in log line", () => {
    const { writes, mockWrite, restore } = captureStderr()
    const logger = new Logger(LogLevel.INFO)

    logger.info("test", { key: "value", num: 42 })

    assert.equal(mockWrite.mock.callCount(), 1)
    assert.ok(writes[0].includes("test"))
    assert.ok(writes[0].includes('"key":"value"'))
    restore()
  })

  it("does not append extra JSON when data is absent", () => {
    const { writes, mockWrite, restore } = captureStderr()
    const logger = new Logger(LogLevel.INFO)

    logger.info("plain message")

    const line = writes[0]
    assert.ok(line.includes("plain message"))
    // The line should end with "plain message\n" — no extra JSON
    assert.equal(line.trim().split(" ").pop(), "message")
    restore()
  })
})

describe("Logger — environment variable LOG_LEVEL", () => {
  it("respects LOG_LEVEL env var", () => {
    const orig = process.env.LOG_LEVEL
    process.env.LOG_LEVEL = "ERROR"

    const { writes, mockWrite, restore } = captureStderr()
    const logger = new Logger()

    logger.info("should be filtered")
    logger.error("visible error")

    assert.equal(mockWrite.mock.callCount(), 1)
    assert.ok(writes[0].includes("visible error"))

    process.env.LOG_LEVEL = orig
    restore()
  })
})

describe("Logger — setLevel", () => {
  it("changes log level at runtime", () => {
    const { writes, mockWrite, restore } = captureStderr()
    const logger = new Logger(LogLevel.WARN)

    logger.warn("should appear")
    logger.setLevel(LogLevel.ERROR)
    logger.warn("should be filtered after level change")
    logger.error("should appear after level change")

    assert.equal(mockWrite.mock.callCount(), 2)
    restore()
  })
})
