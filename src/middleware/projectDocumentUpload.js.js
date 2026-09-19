import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsRoot = path.join(__dirname, "../../uploads/projects");

if (!fs.existsSync(uploadsRoot)) {
  fs.mkdirSync(uploadsRoot, {
    recursive: true,
  });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const { projectId } = req.params;

    const projectFolder = path.join(uploadsRoot, projectId);

    if (!fs.existsSync(projectFolder)) {
      fs.mkdirSync(projectFolder, {
        recursive: true,
      });
    }

    cb(null, projectFolder);
  },

  filename: (req, file, cb) => {
    const timestamp = Date.now();

    const safeName = file.originalname
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/\s+/g, "_");

    cb(null, `${timestamp}-${safeName}`);
  },
});

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

const fileFilter = (req, file, cb) => {
  const extension = path.extname(file.originalname).toLowerCase();

  if (!allowedExtensions.has(extension)) {
    return cb(
      new Error(
        `Unsupported file type: ${extension || "unknown"}`
      )
    );
  }

  cb(null, true);
};

const projectDocumentUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

export default projectDocumentUpload;