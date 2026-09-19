import mongoose from "mongoose";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

import Project from "../models/Project.js";
import ProjectDocument from "../models/ProjectDocument.js";

// =========================================================
// PATH
// =========================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsRoot = path.join(
  __dirname,
  "../../uploads/projects"
);

// =========================================================
// HELPERS
// =========================================================

const getDocumentResponse = (document) => {
  const object =
    typeof document.toObject === "function"
      ? document.toObject()
      : document;

  return {
    ...object,

    fileUrl: `/uploads/projects/${object.projectId}/${encodeURIComponent(
      object.fileName
    )}`,
  };
};

// =========================================================
// GET PROJECT DOCUMENTS
// GET /api/project-documents/project/:projectId
// =========================================================

export const getProjectDocuments = async (
  req,
  res
) => {
  try {
    const { projectId } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(
        projectId
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID.",
      });
    }

    const project =
      await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found.",
      });
    }

    const documents =
      await ProjectDocument.find({
        projectId,
      }).sort({
        createdAt: -1,
      });

    return res.status(200).json({
      success: true,
      count: documents.length,
      documents: documents.map(
        getDocumentResponse
      ),
    });
  } catch (error) {
    console.error(
      "Get project documents error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to load project documents.",
    });
  }
};

// =========================================================
// UPLOAD PROJECT DOCUMENT
// POST /api/project-documents/project/:projectId
// =========================================================

export const uploadProjectDocument = async (
  req,
  res
) => {
  try {
    const { projectId } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(
        projectId
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID.",
      });
    }

    const project =
      await Project.findById(projectId);

    if (!project) {
      if (req.file?.path) {
        try {
          await fs.unlink(req.file.path);
        } catch {
          // Ignore cleanup error
        }
      }

      return res.status(404).json({
        success: false,
        message: "Project not found.",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please select a document.",
      });
    }

    const relativeStoragePath = path
      .relative(
        uploadsRoot,
        req.file.path
      )
      .replace(/\\/g, "/");

    const uploadedBy =
      req.body?.uploadedBy || "";

    const uploadedByName =
      req.body?.uploadedByName || "";

    const document =
      await ProjectDocument.create({
        projectId,

        originalName:
          req.file.originalname,

        fileName:
          req.file.filename,

        storagePath:
          relativeStoragePath,

        mimeType:
          req.file.mimetype,

        size:
          req.file.size,

        uploadedBy,

        uploadedByName,
      });

    return res.status(201).json({
      success: true,
      message:
        "Document uploaded successfully.",
      document:
        getDocumentResponse(document),
    });
  } catch (error) {
    console.error(
      "Upload project document error:",
      error
    );

    if (req.file?.path) {
      try {
        await fs.unlink(req.file.path);
      } catch {
        // Ignore cleanup error
      }
    }

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to upload document.",
    });
  }
};

// =========================================================
// DELETE PROJECT DOCUMENT
// DELETE /api/project-documents/:id
// =========================================================

export const deleteProjectDocument = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(id)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid document ID.",
      });
    }

    const document =
      await ProjectDocument.findById(id);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found.",
      });
    }

    const filePath = path.join(
      uploadsRoot,
      document.storagePath
    );

    try {
      await fs.unlink(filePath);
    } catch (error) {
      if (error.code !== "ENOENT") {
        console.error(
          "Delete physical document error:",
          error
        );
      }
    }

    await ProjectDocument.findByIdAndDelete(
      id
    );

    return res.status(200).json({
      success: true,
      message:
        "Document deleted successfully.",
    });
  } catch (error) {
    console.error(
      "Delete project document error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to delete document.",
    });
  }
};