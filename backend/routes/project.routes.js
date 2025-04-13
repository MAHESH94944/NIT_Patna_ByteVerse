import { Router } from "express";
import { body } from "express-validator";
import * as projectController from "../controllers/project.controller.js";
import * as authMiddleWare from "../middleware/auth.middleware.js";

const router = Router();

router.post(
  "/create",
  authMiddleWare.authUser,
  body("name").isString().withMessage("Name is required"),
  projectController.createProject
);

router.get("/all", authMiddleWare.authUser, projectController.getAllProject);

router.put(
  "/add-user",
  authMiddleWare.authUser,
  body("projectId").isString().withMessage("Project ID is required"),
  body("users")
    .isArray({ min: 1 })
    .withMessage("Users must be an array of strings")
    .bail()
    .custom((users) => users.every((user) => typeof user === "string"))
    .withMessage("Each user must be a string"),
  projectController.addUserToProject
);

router.get(
  "/get-project/:projectId",
  authMiddleWare.authUser,
  projectController.getProjectById
);

router.put(
  "/update-file-tree",
  authMiddleWare.authUser,
  body("projectId").isString().withMessage("Project ID is required"),
  body("fileTree").isObject().withMessage("File tree is required"),
  projectController.updateFileTree
);

// Add this route at the end of the file, before the export
router.delete("/:id", authMiddleWare.authUser, projectController.deleteProject);

// Add these to your existing routes
router.post(
  "/generate-docs",
  authMiddleWare.authUser,
  body("code").isString().withMessage("Code is required"),
  projectController.generateDocs
);

router.post(
  "/optimize-code",
  authMiddleWare.authUser,
  body("code").isString().withMessage("Code is required"),
  projectController.optimizeCode
);

router.get(
  "/:projectId/analytics",
  authMiddleWare.authUser,
  projectController.getProjectAnalytics
);

router.get(
  "/templates",
  authMiddleWare.authUser,
  projectController.getAvailableTemplates
);

export default router;
