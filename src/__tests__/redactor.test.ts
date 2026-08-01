import { describe, it } from "node:test"
import assert from "node:assert"
import { redactLine, redactText } from "../domains/laravel/security/redactor.js"

describe("redactLine", () => {
  it("keeps safe keys unchanged", () => {
    assert.equal(redactLine("APP_NAME=Laravel"), "APP_NAME=Laravel")
    assert.equal(redactLine("DB_HOST=localhost"), "DB_HOST=localhost")
    assert.equal(redactLine("MAIL_USERNAME=admin@example.com"), "MAIL_USERNAME=admin@example.com")
    assert.equal(redactLine("SESSION_DRIVER=file"), "SESSION_DRIVER=file")
    assert.equal(redactLine("APP_DEBUG=true"), "APP_DEBUG=true")
  })

  it("redacts sensitive keys", () => {
    assert.equal(redactLine("APP_KEY=base64:abc"), "APP_KEY=[REDACTED]")
    assert.equal(redactLine("DB_PASSWORD=secret"), "DB_PASSWORD=[REDACTED]")
    assert.equal(redactLine("MAIL_PASSWORD=pass123"), "MAIL_PASSWORD=[REDACTED]")
    assert.equal(redactLine("STRIPE_SECRET=sk_test_xxx"), "STRIPE_SECRET=[REDACTED]")
    assert.equal(redactLine("PUSHER_APP_SECRET=pusher-secret"), "PUSHER_APP_SECRET=[REDACTED]")
    assert.equal(redactLine("AWS_SECRET_ACCESS_KEY=aws-secret"), "AWS_SECRET_ACCESS_KEY=[REDACTED]")
    assert.equal(redactLine("MY_TOKEN=abc123"), "MY_TOKEN=[REDACTED]")
  })

  it("preserves comments and empty lines", () => {
    assert.equal(redactLine("# APP_KEY=foo"), "# APP_KEY=foo")
    assert.equal(redactLine(""), "")
  })

  it("trims spaces around the key", () => {
    assert.equal(redactLine("APP_KEY = base64:abc"), "APP_KEY=[REDACTED]")
  })

  it("leaves non-assignment lines untouched", () => {
    assert.equal(redactLine("plain text without equals"), "plain text without equals")
  })
})

describe("redactText", () => {
  it("redacts across multiple lines", () => {
    const input = "APP_NAME=Laravel\nAPP_KEY=base64:abc\nDB_PASSWORD=secret\n"
    const output = redactText(input)
    assert.ok(output.includes("APP_NAME=Laravel"))
    assert.ok(output.includes("APP_KEY=[REDACTED]"))
    assert.ok(output.includes("DB_PASSWORD=[REDACTED]"))
    assert.ok(!output.includes("base64:abc"))
    assert.ok(!output.includes("secret"))
  })
})
