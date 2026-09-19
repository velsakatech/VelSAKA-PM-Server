import express from "express";

import {
  getProjectDocuments,
  uploadProjectDocument,
  deleteProjectDocument,
} from "../controllers/projectDocumentController.js";

import projectDocumentUpload from "../middleware/projectDocumentUpload.js";

const router = express.Router();

router.get(
  "/project/:projectId",
  getProjectDocuments
);

router.post(
  "/project/:projectId",
  projectDocumentUpload.single("document"),
  uploadProjectDocument
);

router.delete(
  "/:id",
  deleteProjectDocument
);

export default router;