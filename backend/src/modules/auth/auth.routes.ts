import { Router } from "express";
import { authController } from "./auth.controller";
import { validate } from "../../middleware/validation.middleware";
import { authenticate } from "../../middleware/auth.middleware";
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  refreshTokenSchema,
} from "./auth.validation";

const router = Router();

router.post(
  "/register",
  validate(registerSchema),
  authController.register.bind(authController),
);
router.post(
  "/login",
  validate(loginSchema),
  authController.login.bind(authController),
);
router.post(
  "/refresh-token",
  validate(refreshTokenSchema),
  authController.refreshToken.bind(authController),
);
router.post(
  "/logout",
  validate(refreshTokenSchema),
  authController.logout.bind(authController),
);
router.post(
  "/forgot-password",
  validate(forgotPasswordSchema),
  authController.forgotPassword.bind(authController),
);
router.post(
  "/reset-password",
  validate(resetPasswordSchema),
  authController.resetPassword.bind(authController),
);
router.get("/me", authenticate, authController.getMe.bind(authController));

export default router;
