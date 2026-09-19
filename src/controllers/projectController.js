// controllers/projectController.js

import Project from "../models/Project.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import mongoose from "mongoose";

// ======================================================
// HELPER - ADD MEMBER DETAILS TO PROJECTS
// ======================================================

const populateProjectMembers = async (projects) => {
  const projectList = Array.isArray(projects)
    ? projects
    : [projects];

  // ----------------------------------------------
  // Collect all unique member IDs
  // ----------------------------------------------

  const memberIds = [
    ...new Set(
      projectList.flatMap((project) =>
        Array.isArray(project.members)
          ? project.members.map((id) => String(id))
          : []
      )
    ),
  ];

  // ----------------------------------------------
  // No members
  // ----------------------------------------------

  if (memberIds.length === 0) {
    return projectList.map((project) => ({
      ...project,
      memberDetails: [],
    }));
  }

  // ----------------------------------------------
  // Fetch users
  // ----------------------------------------------

  const users = await User.find({
    _id: { $in: memberIds },
  })
    .select("_id name email jobRole accessRole status")
    .lean();

  // ----------------------------------------------
  // Create user lookup map
  // ----------------------------------------------

  const userMap = new Map(
    users.map((user) => [
      String(user._id),
      user,
    ])
  );

  // ----------------------------------------------
  // Attach member details
  // ----------------------------------------------

  return projectList.map((project) => ({
    ...project,

    memberDetails: (project.members || [])
      .map((memberId) => {
        const user = userMap.get(
          String(memberId)
        );

        if (!user) {
          return null;
        }

        return {
          _id: String(user._id),
          name: user.name || "Unknown User",
          email: user.email || "",
          jobRole: user.jobRole || "",
          accessRole: user.accessRole || "",
          status: user.status || "",
        };
      })
      .filter(Boolean),
  }));
};

// ======================================================
// CREATE PROJECT
// ======================================================

export const createProject = async (req, res) => {
  try {
    const {
      name,
      description,
      status,
      priority,
      startDate,
      dueDate,
      createdBy,
      createdByName,
      members,
    } = req.body;

    // -----------------------------
    // VALIDATION
    // -----------------------------

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Project name is required",
      });
    }

    // -----------------------------
    // NORMALIZE MEMBERS
    // -----------------------------

    const projectMembers = Array.isArray(members)
      ? [
          ...new Set(
            members
              .filter(Boolean)
              .map((member) => String(member))
          ),
        ]
      : [];

    // -----------------------------
    // DUPLICATE PROJECT CHECK
    // -----------------------------

    const existingProject =
      await Project.findOne({
        name: name.trim(),
      });

    if (existingProject) {
      return res.status(409).json({
        success: false,
        message:
          "A project with this name already exists",
      });
    }

    // -----------------------------
    // CREATE PROJECT
    // -----------------------------

    const project = await Project.create({
      name: name.trim(),
      description: description?.trim() || "",
      status: status || "planning",
      priority: priority || "medium",
      startDate: startDate || null,
      dueDate: dueDate || null,
      createdBy: createdBy || "",
      createdByName: createdByName || "",
      members: projectMembers,
    });

    // ==================================================
    // CREATE NOTIFICATIONS
    // ==================================================

    if (projectMembers.length > 0) {
      const notifications = projectMembers.map(
        (userId) => ({
          userId,

          type: "project_assigned",

          title: "New Project Assigned",

          message: `You have been assigned to the project "${project.name}".`,

          projectId: String(project._id),

          projectName: project.name,

          isRead: false,
        })
      );

      await Notification.insertMany(
        notifications
      );
    }

    // ==================================================
    // GET MEMBER DETAILS
    // ==================================================

    const projectWithMembers =
      await populateProjectMembers(project);

    // -----------------------------
    // RESPONSE
    // -----------------------------

    return res.status(201).json({
      success: true,
      message: "Project created successfully",
      project: projectWithMembers[0],
    });
  } catch (error) {
    console.error(
      "Create project error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to create project",
    });
  }
};

// ======================================================
// GET ALL PROJECTS
// ======================================================

export const getProjects = async (req, res) => {
  try {
    const projects = await Project.find()
      .sort({ createdAt: -1 })
      .lean();

    // ----------------------------------------------
    // Add member details
    // ----------------------------------------------

    const projectsWithMembers =
      await populateProjectMembers(projects);

    return res.status(200).json({
      success: true,
      projects: projectsWithMembers,
    });
  } catch (error) {
    console.error(
      "Get projects error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch projects",
    });
  }
};

// ======================================================
// GET PROJECTS FOR A USER
// ======================================================

export const getUserProjects = async (req, res) => {
  try {
    const { userId } = req.params;

    // -----------------------------
    // VALIDATE USER ID
    // -----------------------------

    if (
      !userId ||
      !mongoose.Types.ObjectId.isValid(userId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    // -----------------------------
    // FIND ASSIGNED PROJECTS
    // -----------------------------

    const projects = await Project.find({
      members: userId,
    })
      .sort({ createdAt: -1 })
      .lean();

    // -----------------------------
    // ADD MEMBER DETAILS
    // -----------------------------

    const projectsWithMembers =
      await populateProjectMembers(projects);

    return res.status(200).json({
      success: true,
      count: projectsWithMembers.length,
      projects: projectsWithMembers,
    });
  } catch (error) {
    console.error(
      "Get user projects error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to load projects",
    });
  }
};

// ======================================================
// GET SINGLE PROJECT
// ======================================================

export const getProjectById = async (req, res) => {
  try {
    const { id } = req.params;

    // -----------------------------
    // VALIDATE ID
    // -----------------------------

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Project ID is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID",
      });
    }

    // -----------------------------
    // FIND PROJECT
    // -----------------------------

    const project =
      await Project.findById(id).lean();

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    // ----------------------------------------------
    // ADD MEMBER DETAILS
    // ----------------------------------------------

    const projectWithMembers =
      await populateProjectMembers(project);

    return res.status(200).json({
      success: true,
      project: projectWithMembers[0],
    });
  } catch (error) {
    console.error(
      "Get project error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch project",
    });
  }
};

// ======================================================
// UPDATE PROJECT
// ======================================================

export const updateProject = async (req, res) => {
  try {
    const {
      name,
      description,
      status,
      priority,
      startDate,
      dueDate,
      members,
    } = req.body;

    // -----------------------------
    // VALIDATE PROJECT ID
    // -----------------------------

    const { id } = req.params;

    if (
      !id ||
      !mongoose.Types.ObjectId.isValid(id)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID",
      });
    }

    // -----------------------------
    // FIND PROJECT
    // -----------------------------

    const project =
      await Project.findById(id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    // ==================================================
    // STORE OLD MEMBERS
    // ==================================================

    const oldMembers = Array.isArray(
      project.members
    )
      ? project.members.map((id) =>
          String(id)
        )
      : [];

    // ==================================================
    // UPDATE NAME
    // ==================================================

    if (name !== undefined) {
      const trimmedName = name.trim();

      if (!trimmedName) {
        return res.status(400).json({
          success: false,
          message:
            "Project name is required",
        });
      }

      const duplicate =
        await Project.findOne({
          name: trimmedName,
          _id: {
            $ne: project._id,
          },
        });

      if (duplicate) {
        return res.status(409).json({
          success: false,
          message:
            "A project with this name already exists",
        });
      }

      project.name = trimmedName;
    }

    // ==================================================
    // UPDATE DESCRIPTION
    // ==================================================

    if (description !== undefined) {
      project.description =
        description?.trim() || "";
    }

    // ==================================================
    // UPDATE STATUS
    // ==================================================

    if (status !== undefined) {
      project.status = status;
    }

    // ==================================================
    // UPDATE PRIORITY
    // ==================================================

    if (priority !== undefined) {
      project.priority = priority;
    }

    // ==================================================
    // UPDATE START DATE
    // ==================================================

    if (startDate !== undefined) {
      project.startDate =
        startDate || null;
    }

    // ==================================================
    // UPDATE DUE DATE
    // ==================================================

    if (dueDate !== undefined) {
      project.dueDate =
        dueDate || null;
    }

    // ==================================================
    // UPDATE MEMBERS
    // ==================================================

    let newMembers = oldMembers;

    if (members !== undefined) {
      newMembers = Array.isArray(members)
        ? [
            ...new Set(
              members
                .filter(Boolean)
                .map((member) =>
                  String(member)
                )
            ),
          ]
        : [];

      project.members = newMembers;
    }

    // ==================================================
    // SAVE PROJECT
    // ==================================================

    await project.save();

    // ==================================================
    // FIND NEWLY ASSIGNED USERS
    // ==================================================

    const newlyAssignedUsers =
      newMembers.filter(
        (userId) =>
          !oldMembers.includes(userId)
      );

    // ==================================================
    // NOTIFY NEW USERS
    // ==================================================

    if (
      newlyAssignedUsers.length > 0
    ) {
      const notifications =
        newlyAssignedUsers.map(
          (userId) => ({
            userId,

            type: "project_assigned",

            title:
              "New Project Assigned",

            message: `You have been assigned to the project "${project.name}".`,

            projectId:
              String(project._id),

            projectName:
              project.name,

            isRead: false,
          })
        );

      await Notification.insertMany(
        notifications
      );
    }

    // ==================================================
    // GET UPDATED PROJECT WITH MEMBER DETAILS
    // ==================================================

    const updatedProject =
      await Project.findById(
        project._id
      ).lean();

    const projectWithMembers =
      await populateProjectMembers(
        updatedProject
      );

    // -----------------------------
    // RESPONSE
    // -----------------------------

    return res.status(200).json({
      success: true,
      message:
        "Project updated successfully",
      project: projectWithMembers[0],
    });
  } catch (error) {
    console.error(
      "Update project error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to update project",
    });
  }
};

// ======================================================
// DELETE PROJECT
// ======================================================

export const deleteProject = async (req, res) => {
  try {
    const { id } = req.params;

    // -----------------------------
    // VALIDATE ID
    // -----------------------------

    if (
      !id ||
      !mongoose.Types.ObjectId.isValid(id)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID",
      });
    }

    // -----------------------------
    // FIND PROJECT
    // -----------------------------

    const project =
      await Project.findById(id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    // -----------------------------
    // DELETE RELATED NOTIFICATIONS
    // -----------------------------

    await Notification.deleteMany({
      projectId: String(project._id),
    });

    // -----------------------------
    // DELETE PROJECT
    // -----------------------------

    await Project.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message:
        "Project deleted successfully",
    });
  } catch (error) {
    console.error(
      "Delete project error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to delete project",
    });
  }
};