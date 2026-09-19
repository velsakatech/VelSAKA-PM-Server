import mongoose from "mongoose";

const projectDocumentSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },

    originalName: {
      type: String,
      required: true,
      trim: true,
    },

    fileName: {
      type: String,
      required: true,
      trim: true,
    },

    storagePath: {
      type: String,
      required: true,
      trim: true,
    },

    mimeType: {
      type: String,
      default: "application/octet-stream",
      trim: true,
    },

    size: {
      type: Number,
      default: 0,
    },

    uploadedBy: {
      type: String,
      default: "",
      trim: true,
    },

    uploadedByName: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const ProjectDocument = mongoose.model(
  "ProjectDocument",
  projectDocumentSchema
);

export default ProjectDocument;