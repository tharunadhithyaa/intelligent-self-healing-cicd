import { Router } from "express";
import { officerController } from "./officer.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { checkPermission } from "../../middleware/permission.middleware";
import { validate } from "../../middleware/validation.middleware";
import { Permissions } from "../../constants/permissions.constants";
import {
  transitionStatusSchema,
  assignWorkerSchema,
  addNoteSchema,
  submitResolutionSchema,
} from "./officer.validation";

const router = Router();

// Protect all officer routes with authentication and COMPLAINTS_MANAGE permission check
router.use(authenticate);
router.use(checkPermission(Permissions.COMPLAINTS_MANAGE));

router.get(
  "/stats",
  officerController.getDashboardStats.bind(officerController),
);
router.get(
  "/dept-stats",
  officerController.getDepartmentStats.bind(officerController),
);
router.get(
  "/complaints",
  officerController.getComplaints.bind(officerController),
);
router.get(
  "/complaints/:id",
  officerController.getComplaintDetails.bind(officerController),
);
router.put(
  "/complaints/:id/status",
  validate(transitionStatusSchema),
  officerController.transitionStatus.bind(officerController),
);
router.post(
  "/complaints/:id/assign",
  validate(assignWorkerSchema),
  officerController.assignWorker.bind(officerController),
);
router.post(
  "/complaints/:id/notes",
  validate(addNoteSchema),
  officerController.addInternalNote.bind(officerController),
);
router.post(
  "/complaints/:id/resolution",
  validate(submitResolutionSchema),
  officerController.submitResolution.bind(officerController),
);
router.get(
  "/workers",
  officerController.getAvailableWorkers.bind(officerController),
);

export default router;
