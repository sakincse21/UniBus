import multer from "multer";
import path from "path";
import fs from "fs";

const uploadDir = path.join(__dirname, "../../../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `routine-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/heic"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPEG, PNG, WebP and HEIC images are allowed"));
  }
};

export const uploadRoutineImage = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
}).single("routineImage");

const xlsxFileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  const allowedTypes = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only .xlsx and .xls files are allowed"));
  }
};

export const uploadXlsx = multer({
  storage,
  fileFilter: xlsxFileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
}).single("file");

// Generic file upload for attachments - supports any file type
const attachmentFileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  // Accept any file type
  cb(null, true);
};

const attachmentStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const attachmentsDir = path.join(uploadDir, "attachments");
    if (!fs.existsSync(attachmentsDir)) {
      fs.mkdirSync(attachmentsDir, { recursive: true });
    }
    cb(null, attachmentsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `attachment-${uniqueSuffix}${ext}`);
  },
});

export const uploadAttachments = multer({
  storage: attachmentStorage,
  fileFilter: attachmentFileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB max file size
}).array("attachments", 10); // Max 10 files per upload
