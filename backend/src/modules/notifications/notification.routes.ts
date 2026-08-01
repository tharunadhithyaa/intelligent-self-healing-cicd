import { Router } from "express";
import { notificationController } from "./notification.controller";
import { authenticate } from "../../middleware/auth.middleware";

const router = Router();

// Protect all notification routes
router.use(authenticate);

router.get(
  "/",
  notificationController.getNotifications.bind(notificationController),
);
router.put(
  "/read-all",
  notificationController.markAllAsRead.bind(notificationController),
);
router.put(
  "/:id/read",
  notificationController.markAsRead.bind(notificationController),
);
router.delete(
  "/:id",
  notificationController.deleteNotification.bind(notificationController),
);

export default router;
