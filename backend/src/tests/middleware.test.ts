import { Request, Response, NextFunction } from "express";
import { securitySanitizer } from "../middleware/security.middleware";

export const testMiddleware = (): boolean => {
  console.log("🧪 Running Security Middleware Unit Tests...");

  // 1. Setup Request, Response and Next mock objects with strict types
  const reqObject = {
    body: {
      title: "<script>alert('xss')</script>",
      description: "Road damage near main avenue",
      count: 42,
      isActive: true,
      nullField: null,
      "$where": "this.password == 123",
      "nested.key": "invalid_dot_key",
      user: {
        name: "<b onmouseover=alert(1)>Admin</b>",
        "$ne": "citizen",
      },
      tags: ["<b>urgent</b>", { "$gt": 0 }],
      base64Data: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==",
    },
    query: {
      search: "<script>",
      "$ne": "admin",
    },
    params: {
      id: "<123>",
    },
  };

  const req = reqObject as unknown as Request;
  const res = {} as Response;
  let nextCalled = false;
  const next: NextFunction = () => {
    nextCalled = true;
  };

  // 2. Execute Middleware
  securitySanitizer(req, res, next);

  // 3. Verify next() was called
  if (!nextCalled) {
    throw new Error("securitySanitizer failed to call next()");
  }

  // 4. Verify XSS Sanitization in body
  const sanitizedBody = req.body as Record<string, unknown>;
  if (
    sanitizedBody["title"] !== "&lt;script&gt;alert(&#x27;xss&#x27;)&lt;&#x2F;script&gt;" ||
    (sanitizedBody["title"] as string).includes("<script>")
  ) {
    throw new Error("securitySanitizer failed to encode XSS tags in body.title");
  }

  // 5. Verify Safe Input Preservation
  if (sanitizedBody["description"] !== "Road damage near main avenue") {
    throw new Error("securitySanitizer mutated legitimate safe text input");
  }

  // 6. Verify Non-String Values
  if (
    sanitizedBody["count"] !== 42 ||
    sanitizedBody["isActive"] !== true ||
    sanitizedBody["nullField"] !== null
  ) {
    throw new Error("securitySanitizer mutated non-string values");
  }

  // 7. Verify MongoDB Operator Injection Prevention ($ and . key deletions)
  if (
    "$where" in sanitizedBody ||
    "nested.key" in sanitizedBody ||
    "$ne" in (sanitizedBody["user"] as Record<string, unknown>)
  ) {
    throw new Error("securitySanitizer failed to strip $ and . MongoDB injection keys");
  }

  // 8. Verify Nested Object & Array XSS Sanitization
  const userObj = sanitizedBody["user"] as Record<string, unknown>;
  if (userObj["name"] !== "&lt;b onmouseover=alert(1)&gt;Admin&lt;&#x2F;b&gt;") {
    throw new Error("securitySanitizer failed to encode nested object string");
  }

  const tagsArr = sanitizedBody["tags"] as unknown[];
  if (
    tagsArr[0] !== "&lt;b&gt;urgent&lt;&#x2F;b&gt;" ||
    "$gt" in (tagsArr[1] as Record<string, unknown>)
  ) {
    throw new Error("securitySanitizer failed to sanitize array elements");
  }

  // 9. Verify Excluded Image / Base64 Keys
  if (sanitizedBody["base64Data"] !== "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==") {
    throw new Error("securitySanitizer incorrectly encoded base64Data image string");
  }

  // 10. Verify Query and Params Sanitization
  const sanitizedQuery = req.query as Record<string, unknown>;
  const sanitizedParams = req.params as Record<string, unknown>;
  if (
    sanitizedQuery["search"] !== "&lt;script&gt;" ||
    "$ne" in sanitizedQuery ||
    sanitizedParams["id"] !== "&lt;123&gt;"
  ) {
    throw new Error("securitySanitizer failed to sanitize query or params");
  }

  console.log("✅ Security Middleware Unit Tests PASSED cleanly!");
  return true;
};
