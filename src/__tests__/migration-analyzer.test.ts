import { describe, it } from "node:test"
import assert from "node:assert"
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"
import { parseColumn, parseForeignId, analyzeMigrations } from "../tools/migration-analyzer.js"

describe("migration-analyzer – parseColumn", () => {
  it("parses a simple string column", () => {
    const result = parseColumn('$table->string("name")')
    assert.deepEqual(result, { name: "name", type: "string" })
  })

  it("parses bigIncrements id", () => {
    const result = parseColumn('$table->bigIncrements("id")')
    assert.deepEqual(result, { name: "id", type: "bigIncrements" })
  })

  it("parses nullable column", () => {
    const result = parseColumn('$table->string("email")->nullable()')
    assert.deepEqual(result, { name: "email", type: "string", extras: "nullable" })
  })

  it("parses column with default value", () => {
    const result = parseColumn('$table->boolean("is_admin")->default(false)')
    assert.equal(result?.name, "is_admin")
    assert.equal(result?.type, "boolean")
    assert.ok(result?.extras?.includes("default: false"))
  })

  it("parses unique column", () => {
    const result = parseColumn('$table->string("slug")->unique()')
    assert.equal(result?.extras, "unique")
  })

  it("parses column with multiple extras", () => {
    const result = parseColumn('$table->integer("age")->nullable()->unsigned()')
    assert.equal(result?.extras, "nullable, unsigned")
  })

  it("non-column methods return null", () => {
    assert.equal(parseColumn('$table->timestamps()'), null)
    assert.equal(parseColumn('$table->foreignId("user_id")->constrained()'), null)
  })

  it("unknown column types return null", () => {
    assert.equal(parseColumn('$table->fooBar("baz")'), null)
  })

  it("non-matching lines return null", () => {
    assert.equal(parseColumn('// just a comment'), null)
    assert.equal(parseColumn(''), null)
  })
})

describe("migration-analyzer – parseForeignId", () => {
  it("parses foreignId with constrained", () => {
    const result = parseForeignId('$table->foreignId("user_id")->constrained()')
    assert.deepEqual(result, { column: "user_id", references: "user.id" })
  })

  it("returns null for non-foreignId lines", () => {
    assert.equal(parseForeignId('$table->string("name")'), null)
    assert.equal(parseForeignId(''), null)
  })
})

describe("migration-analyzer – analyzeMigrations", () => {
  let tmpDir: string

  it("returns empty array for non-existent directory", () => {
    const result = analyzeMigrations("/nonexistent/path")
    assert.deepEqual(result, [])
  })

  it("returns empty array for empty directory", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "migration-test-"))
    const result = analyzeMigrations(tmpDir)
    assert.deepEqual(result, [])
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it("parses a migration file and extracts table structure", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "migration-test-"))

    writeFileSync(join(tmpDir, "2024_01_01_000001_create_users_table.php"), `<?php

use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('name');
            $table->string('email')->unique();
            $table->string('password');
            $table->foreignId('role_id')->constrained();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('users');
    }
};
`)

    writeFileSync(join(tmpDir, "2024_01_01_000002_create_posts_table.php"), `<?php

use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('posts', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('title');
            $table->text('content')->nullable();
            $table->foreignId('user_id')->constrained();
            $table->boolean('is_published')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('posts');
    }
};
`)

    const tables = analyzeMigrations(tmpDir)
    assert.equal(tables.length, 2)

    // Verify users table
    const users = tables.find((t) => t.table === "users")
    assert.ok(users)
    assert.equal(users.columns.length, 4) // id, name, email, password
    assert.equal(users.columns[0].name, "id")
    assert.equal(users.columns[0].type, "bigIncrements")
    assert.equal(users.columns[1].name, "name")
    assert.equal(users.columns[1].type, "string")
    assert.equal(users.foreignKeys.length, 1)
    assert.equal(users.foreignKeys[0].column, "role_id")
    assert.equal(users.foreignKeys[0].references, "role.id")
    assert.ok(users.hasTimestamps)

    // Verify posts table
    const posts = tables.find((t) => t.table === "posts")
    assert.ok(posts)
    assert.equal(posts.columns.length, 4) // id, title, content (nullable extra), is_published (default)
    assert.equal(posts.columns[2].name, "content")
    assert.equal(posts.columns[2].type, "text")
    assert.ok(posts.columns[2].extras?.includes("nullable"))
    assert.equal(posts.columns[3].name, "is_published")
    assert.equal(posts.columns[3].type, "boolean")
    assert.ok(posts.columns[3].extras?.includes("default: false"))
    assert.equal(posts.foreignKeys.length, 1)
    assert.equal(posts.foreignKeys[0].column, "user_id")
    assert.equal(posts.foreignKeys[0].references, "user.id")

    rmSync(tmpDir, { recursive: true, force: true })
  })
})
