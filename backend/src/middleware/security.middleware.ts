import { Request, Response, NextFunction } from "express";

// Recursively sanitize objects to prevent MongoDB Operator Injection
const sanitizeObject = (obj: any): any => {
  if (obj instanceof Array) {
    for (let i = 0; i < obj.length; i++) {
      if (typeof obj[i] === "object" && obj[i] !== null) {
        obj[i] = sanitizeObject(obj[i]);
      }
    }
  } else if (typeof obj === "object" && obj !== null) {
    Object.keys(obj).forEach((key) => {
      if (key.startsWith("$") || key.includes(".")) {
        delete obj[key];
      } else if (typeof obj[key] === "object" && obj[key] !== null) {
        obj[key] = sanitizeObject(obj[key]);
      }
    });
  }
  return obj;
};

// Prevent basic Cross-Site Scripting (XSS) by encoding unsafe HTML tags
const sanitizeXSSString = (val: string): string => {
  return val
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
};

const sanitizeXSS = (obj: any): any => {
  if (typeof obj === "string") {
    return sanitizeXSSString(obj);
  } else if (obj instanceof Array) {
    for (let i = 0; i < obj.length; i++) {
      obj[i] = sanitizeXSS(obj[i]);
    }
  } else if (typeof obj === "object" && obj !== null) {
    Object.keys(obj).forEach((key) => {
      // Exclude base64 strings or files which may contain safe slashes/characters
      if (key === "base64Data" || key === "image" || key === "images") {
        return;
      }
      obj[key] = sanitizeXSS(obj[key]);
    });
  }
  return obj;
};

export const securitySanitizer = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  if (req.body) {
    sanitizeObject(req.body);
    sanitizeXSS(req.body);
  }
  if (req.query) {
    sanitizeObject(req.query);
    sanitizeXSS(req.query);
  }
  if (req.params) {
    sanitizeObject(req.params);
    sanitizeXSS(req.params);
  }
  next();
};
