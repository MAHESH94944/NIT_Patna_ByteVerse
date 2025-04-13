import projectModel from "../models/project.model.js";
import * as projectService from "../services/project.service.js";
import userModel from "../models/user.model.js";
import { validationResult } from "express-validator";
import * as aiService from "../services/ai.service.js";

export const generateDocs = async (req, res) => {
  try {
    const { code } = req.body;
    const result = await aiService.generateDocumentation(code);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const optimizeCode = async (req, res) => {
  try {
    const { code } = req.body;
    const result = await aiService.optimizeCode(code);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getProjectAnalytics = async (req, res) => {
  try {
    const { projectId } = req.params;
    const analytics = await projectService.getProjectAnalytics(projectId);
    res.json(analytics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getAvailableTemplates = async (req, res) => {
  try {
    res.json([
      { id: "react-app", name: "React Application" },
      { id: "node-server", name: "Node.js Server" },
      { id: "empty", name: "Empty Project" },
    ]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createProject = async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { name } = req.body;
    const loggedInUser = await userModel.findOne({ email: req.user.email });
    const userId = loggedInUser._id;

    const newProject = await projectService.createProject({ name, userId });

    res.status(201).json(newProject);
  } catch (err) {
    console.log(err);
    res.status(400).send(err.message);
  }
};

export const getAllProject = async (req, res) => {
  try {
    const loggedInUser = await userModel.findOne({
      email: req.user.email,
    });

    const allUserProjects = await projectService.getAllProjectByUserId({
      userId: loggedInUser._id,
    });

    return res.status(200).json({
      projects: allUserProjects,
    });
  } catch (err) {
    console.log(err);
    res.status(400).json({ error: err.message });
  }
};

export const addUserToProject = async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { projectId, users } = req.body;

    const loggedInUser = await userModel.findOne({
      email: req.user.email,
    });

    const project = await projectService.addUsersToProject({
      projectId,
      users,
      userId: loggedInUser._id,
    });

    return res.status(200).json({
      project,
    });
  } catch (err) {
    console.log(err);
    res.status(400).json({ error: err.message });
  }
};

export const getProjectById = async (req, res) => {
  const { projectId } = req.params;

  try {
    const project = await projectService.getProjectById({ projectId });

    return res.status(200).json({
      project,
    });
  } catch (err) {
    console.log(err);
    res.status(400).json({ error: err.message });
  }
};

export const updateFileTree = async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { projectId, fileTree } = req.body;

    const project = await projectService.updateFileTree({
      projectId,
      fileTree,
    });

    return res.status(200).json({
      project,
    });
  } catch (err) {
    console.log(err);
    res.status(400).json({ error: err.message });
  }
};

// delete project controller
export const deleteProject = async (req, res) => {
  try {
    const { id } = req.params;
    const loggedInUser = await userModel.findOne({ email: req.user.email });

    const deletedProject = await projectService.deleteProject({
      projectId: id,
      userId: loggedInUser._id,
    });

    return res.status(200).json({
      message: "Project deleted successfully",
      project: deletedProject,
    });
  } catch (err) {
    console.log(err);
    res.status(400).json({ error: err.message });
  }
};
