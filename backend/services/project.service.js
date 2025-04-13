import projectModel from "../models/project.model.js";
import mongoose from "mongoose";

const DEFAULT_TEMPLATES = {
  "react-app": {
    name: "React App",
    fileTree: {
      src: {
        directory: {
          "App.js": { file: { contents: "// React app content" } },
          "index.js": { file: { contents: "// Index file" } },
        },
      },
      "package.json": {
        file: {
          contents: JSON.stringify(
            {
              name: "react-app",
              dependencies: {
                react: "^18.2.0",
                "react-dom": "^18.2.0",
              },
            },
            null,
            2
          ),
        },
      },
    },
  },
  "node-server": {
    name: "Node.js Server",
    fileTree: {
      "server.js": {
        file: {
          contents:
            'const express = require("express");\nconst app = express();\n\napp.get("/", (req, res) => {\n  res.send("Hello World!");\n});\n\napp.listen(3000, () => {\n  console.log("Server running on port 3000");\n});',
        },
      },
      "package.json": {
        file: {
          contents: JSON.stringify(
            {
              name: "node-server",
              dependencies: {
                express: "^4.18.2",
              },
            },
            null,
            2
          ),
        },
      },
    },
  },
};

export const createProject = async ({ name, userId, template }) => {
  if (!name) throw new Error("Name is required");
  if (!userId) throw new Error("UserId is required");

  const fileTree = template ? DEFAULT_TEMPLATES[template]?.fileTree || {} : {};

  const project = await projectModel.create({
    name,
    users: [userId],
    fileTree,
    createdBy: userId,
    template: template || "custom",
  });

  return project;
};

// Add project analytics
export const getProjectAnalytics = async (projectId) => {
  const project = await projectModel.findById(projectId);
  if (!project) throw new Error("Project not found");

  // Simple analytics - could be enhanced
  return {
    fileCount: countFiles(project.fileTree),
    collaborators: project.users.length,
    lastUpdated: project.updatedAt,
    fileTypes: analyzeFileTypes(project.fileTree),
  };
};

function countFiles(fileTree) {
  let count = 0;
  for (const key in fileTree) {
    if (fileTree[key].file) {
      count++;
    } else if (fileTree[key].directory) {
      count += countFiles(fileTree[key].directory);
    }
  }
  return count;
}

function analyzeFileTypes(fileTree) {
  const extensions = {};

  function analyze(node) {
    for (const key in node) {
      if (node[key].file) {
        const ext = key.split(".").pop();
        extensions[ext] = (extensions[ext] || 0) + 1;
      } else if (node[key].directory) {
        analyze(node[key].directory);
      }
    }
  }

  analyze(fileTree);
  return extensions;
}

export const getAllProjectByUserId = async ({ userId }) => {
  if (!userId) {
    throw new Error("UserId is required");
  }

  const allUserProjects = await projectModel.find({
    users: userId,
  });

  return allUserProjects;
};

export const addUsersToProject = async ({ projectId, users, userId }) => {
  if (!projectId) {
    throw new Error("projectId is required");
  }

  if (!mongoose.Types.ObjectId.isValid(projectId)) {
    throw new Error("Invalid projectId");
  }

  if (!users) {
    throw new Error("users are required");
  }

  if (
    !Array.isArray(users) ||
    users.some((userId) => !mongoose.Types.ObjectId.isValid(userId))
  ) {
    throw new Error("Invalid userId(s) in users array");
  }

  if (!userId) {
    throw new Error("userId is required");
  }

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error("Invalid userId");
  }

  const project = await projectModel.findOne({
    _id: projectId,
    users: userId,
  });

  console.log(project);

  if (!project) {
    throw new Error("User not belong to this project");
  }

  const updatedProject = await projectModel.findOneAndUpdate(
    {
      _id: projectId,
    },
    {
      $addToSet: {
        users: {
          $each: users,
        },
      },
    },
    {
      new: true,
    }
  );

  return updatedProject;
};

export const getProjectById = async ({ projectId }) => {
  if (!projectId) {
    throw new Error("projectId is required");
  }

  if (!mongoose.Types.ObjectId.isValid(projectId)) {
    throw new Error("Invalid projectId");
  }

  const project = await projectModel
    .findOne({
      _id: projectId,
    })
    .populate("users");

  return project;
};

export const updateFileTree = async ({ projectId, fileTree }) => {
  if (!projectId) {
    throw new Error("projectId is required");
  }

  if (!mongoose.Types.ObjectId.isValid(projectId)) {
    throw new Error("Invalid projectId");
  }

  if (!fileTree) {
    throw new Error("fileTree is required");
  }

  const project = await projectModel.findOneAndUpdate(
    {
      _id: projectId,
    },
    {
      fileTree,
    },
    {
      new: true,
    }
  );

  return project;
};

export const deleteProject = async ({ projectId, userId }) => {
  if (!projectId) {
    throw new Error("projectId is required");
  }

  if (!mongoose.Types.ObjectId.isValid(projectId)) {
    throw new Error("Invalid projectId");
  }

  if (!userId) {
    throw new Error("userId is required");
  }

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error("Invalid userId");
  }

  // First check if the user is part of the project
  const project = await projectModel.findOne({
    _id: projectId,
    users: userId,
  });

  if (!project) {
    throw new Error("User not authorized to delete this project");
  }

  const deletedProject = await projectModel.findByIdAndDelete(projectId);

  if (!deletedProject) {
    throw new Error("Project not found");
  }

  return deletedProject;
};
