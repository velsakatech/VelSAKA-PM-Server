import express from "express";

import {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  getUserTasks,
} from "../controllers/taskController.js";

const router = express.Router();

// ======================================================
// GET ALL TASKS
// ======================================================

router.get("/", getTasks);

// ======================================================
// GET USER TASKS
// IMPORTANT: BEFORE /:id
// ======================================================

router.get("/user/:userId", getUserTasks);

// ======================================================
// GET SINGLE TASK
// ======================================================

router.get("/:id", getTaskById);

// ======================================================
// CREATE TASK
// ======================================================

router.post("/", createTask);

// ======================================================
// UPDATE TASK
// ======================================================

router.put("/:id", updateTask);

// ======================================================
// DELETE TASK
// ======================================================

router.delete("/:id", deleteTask);

export default router;