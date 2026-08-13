import { securitySanitizer } from "../middleware/security.middleware";

export const testMiddleware = () => {
  const req: any = { body: { title: "<script>alert(1)</script>" }, query: {}, params: {} };
  const res: any = {};
  const next = () => {};
  securitySanitizer(req, res, next);
  return !req.body.title.includes("<script>");
};
