import express from "express";

import {
  createUser,
  getUsers,
  getUserByEmail,
  updateUser,
  deleteUser,
} from "../controllers/userController.js";

const router = express.Router();

// =========================================================
// CREATE USER
// POST /api/users
// =========================================================
router.post("/", createUser);

// =========================================================
// GET ALL USERS
// GET /api/users
// =========================================================
router.get("/", getUsers);

// =========================================================
// GET USER PROFILE BY EMAIL
// GET /api/users/profile/:email
// =========================================================
router.get("/profile/:email", getUserByEmail);

// =========================================================
// UPDATE USER
// PUT /api/users/:id
// =========================================================
router.put("/:id", updateUser);

// =========================================================
// DELETE USER
// DELETE /api/users/:id
// =========================================================
router.delete("/:id", deleteUser);

export default router;