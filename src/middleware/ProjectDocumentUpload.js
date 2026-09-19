import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// server/uploads/projects
const uploadsRoot = path.join(__dirname, "../../uploads/projects");

const allowedExtensions = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".txt",
  ".csv",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".zip",
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const projectId = req.params.projectId;

    const projectFolder = path.join(
      uploadsRoot,
      projectId
    );

    // Create project folder automatically
    fs.mkdirSync(projectFolder, {
      recursive: true,
    });

    cb(null, projectFolder);
  },

  filename: (req, file, cb) => {
    const extension = path.extname(
      file.originalname
    ).toLowerCase();

    const originalName = path.basename(
      file.originalname,
      extension
    );

    const safeName =
      originalName
        .replace(/[^a-zA-Z0-9-_]/g, "-")
        .replace(/-+/g, "-")
        .slice(0, 80) || "document";

    const uniqueName = `${Date.now()}-${Math.round(
      Math.random() * 1e9
    )}-${safeName}${extension}`;

    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  const extension = path.extname(
    file.originalname
  ).toLowerCase();

  if (!allowedExtensions.has(extension)) {
    const error = new Error(
      "This file type is not allowed."
    );

    error.code = "INVALID_FILE_TYPE";

    return cb(error, false);
  }

  cb(null, true);
};

const projectDocumentUpload = multer({
  storage,

  limits: {
    // 10 MB maximum
    fileSize: 10 * 1024 * 1024,
  },

  fileFilter,
});

export default projectDocumentUpload;