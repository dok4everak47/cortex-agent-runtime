export type GoldenScenario = {
  id: string
  name: string
  request: string
  workflow?: string
  dryRun?: boolean
  expect: {
    files?: string[]
    routes?: string[]
    testResult?: "pass" | "any"
    artifacts?: string[]
  }
  cleanup: string[]
}

export const SCENARIOS: GoldenScenario[] = [
  {
    id: "crud-post",
    name: "Create a Post CRUD",
    request: "Create a Post CRUD with title:string and content:text",
    workflow: "crudGenerator",
    expect: {
      files: [
        "app/Models/Post.php",
        "app/Http/Controllers/PostController.php",
        "app/Http/Requests/StorePostRequest.php",
      ],
      routes: ["/posts"],
      testResult: "any",
      artifacts: ["app/Models/Post.php", "app/Http/Controllers/PostController.php", "routes/web.php"],
    },
    cleanup: [
      "app/Models/Post.php",
      "app/Http/Controllers/PostController.php",
      "app/Http/Requests/StorePostRequest.php",
      "database/migrations/*_create_posts_table.php",
      "tests/Feature/PostTest.php",
    ],
  },
  {
    id: "feature-comment",
    name: "Add comment feature to blog",
    request: "给博客增加评论功能",
    workflow: "createFeature",
    expect: {
      files: [
        "app/Models/Comment.php",
        "app/Http/Controllers/CommentController.php",
        "resources/views/comments/index.blade.php",
      ],
      routes: ["/comments"],
      testResult: "any",
      artifacts: ["app/Models/Comment.php", "resources/views/comments/index.blade.php"],
    },
    cleanup: [
      "app/Models/Comment.php",
      "app/Http/Controllers/CommentController.php",
      "app/Http/Requests/StoreCommentRequest.php",
      "database/migrations/*_create_comments_table.php",
      "resources/views/comments",
      "tests/Feature/CommentTest.php",
    ],
  },
  {
    id: "api-tag",
    name: "Create Tag REST API",
    request: "为 Tag 创建 REST API with auth",
    workflow: "apiGenerator",
    expect: {
      files: ["app/Http/Controllers/TagController.php", "app/Models/Tag.php"],
      routes: ["/api/tags"],
      testResult: "any",
      artifacts: ["app/Models/Tag.php", "app/Http/Controllers/TagController.php", "routes/api.php"],
    },
    cleanup: [
      "app/Models/Tag.php",
      "app/Http/Controllers/TagController.php",
      "app/Http/Requests/StoreTagRequest.php",
      "database/migrations/*_create_tags_table.php",
      "tests/Feature/TagApiTest.php",
    ],
  },
  {
    id: "debug-sqlstate",
    name: "Debug SQL error",
    request: "SQLSTATE[42P01]: Table not found，怎么解决",
    workflow: "debugWorkflow",
    expect: {
      files: [],
      testResult: "any",
    },
    cleanup: [],
  },
  {
    id: "intent-plan",
    name: "Plan only (dry run)",
    request: "给博客增加评论功能",
    dryRun: true,
    expect: {
      files: [],
    },
    cleanup: [],
  },
]
