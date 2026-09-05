import { Router } from "express";
import { citizenController } from "./citizen.controller";
import { validate } from "../../middleware/validation.middleware";
import { authenticate } from "../../middleware/auth.middleware";
import {
  updateProfileSchema,
  changePasswordSchema,
} from "./citizen.validation";

const router = Router();

// Protect all citizen routes
router.use(authenticate);

router.put(
  "/profile",
  validate(updateProfileSchema),
  citizenController.updateProfile.bind(citizenController),
);
router.put(
  "/security",
  validate(changePasswordSchema),
  citizenController.changePassword.bind(citizenController),
);

router.get("/settings", citizenController.getSettings.bind(citizenController));
router.put(
  "/settings",
  citizenController.updateSettings.bind(citizenController),
);
router.get(
  "/download-data",
  citizenController.downloadData.bind(citizenController),
);

export default router;
