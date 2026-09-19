import express from "express";

import {
  getUserNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "../controllers/notificationController.js";

const router = express.Router();

router.get("/:userId", getUserNotifications);

router.get("/:userId/unread-count", getUnreadNotificationCount);

router.patch("/:id/read", markNotificationAsRead);

router.patch("/:userId/read-all", markAllNotificationsAsRead);

export default router;
