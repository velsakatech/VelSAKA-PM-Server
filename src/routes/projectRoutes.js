import express from "express";

import {
  createProject,
  getProjects,
  getUserProjects,
  getProjectById,
  updateProject,
  deleteProject,
} from "../controllers/projectController.js";

const router = express.Router();

// ======================================================
// CREATE PROJECT
// POST /api/projects
// ======================================================

router.post("/", createProject);

// ======================================================
// GET ALL PROJECTS
// GET /api/projects
// ======================================================

router.get("/", getProjects);

// ======================================================
// GET USER PROJECTS
// GET /api/projects/user/:userId
// IMPORTANT: MUST COME BEFORE /:id
// ======================================================

router.get("/user/:userId", getUserProjects);

// ======================================================
// GET SINGLE PROJECT
// GET /api/projects/:id
// ======================================================

router.get("/:id", getProjectById);

// ======================================================
// UPDATE PROJECT
// PUT /api/projects/:id
// ======================================================

router.put("/:id", updateProject);

// ======================================================
// DELETE PROJECT
// DELETE /api/projects/:id
// ======================================================

router.delete("/:id", deleteProject);

export default router;