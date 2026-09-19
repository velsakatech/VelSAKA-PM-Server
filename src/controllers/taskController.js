import mongoose from "mongoose";
import Tasks from "../models/Tasks.js";

// =========================================================
// GET ALL TASKS
// =========================================================

export const getTasks = async (req, res) => {
  try {
    const tasks = await Tasks.find()
      .populate("assignedTo", "name email")
      .populate("projectId", "name")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      tasks,
    });
  } catch (error) {
    console.error("Get tasks error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch tasks",
    });
  }
};

// =========================================================
// GET TASK BY ID
// =========================================================

export const getTaskById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid task ID",
      });
    }

    const task = await Tasks.findById(id)
      .populate("assignedTo", "name email")
      .populate("projectId", "name")
      .populate("createdBy", "name email");

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    return res.status(200).json({
      success: true,
      task,
    });
  } catch (error) {
    console.error("Get task error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch task",
    });
  }
};

// =========================================================
// CREATE TASK
// =========================================================

export const createTask = async (req, res) => {
  try {
    const {
      title,
      description,
      projectId,
      assignedTo,
      status,
      priority,
      dueDate,
      createdBy,
    } = req.body;

    // -----------------------------
    // REQUIRED FIELDS
    // -----------------------------

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: "Task title is required",
      });
    }

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: "Project is required",
      });
    }

    if (!assignedTo) {
      return res.status(400).json({
        success: false,
        message: "User assignment is required",
      });
    }

    // -----------------------------
    // VALIDATE IDS
    // -----------------------------

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(assignedTo)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    if (
      createdBy &&
      !mongoose.Types.ObjectId.isValid(createdBy)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid creator ID",
      });
    }

    // -----------------------------
    // CREATE TASK
    // -----------------------------

    const task = await Tasks.create({
      title: title.trim(),
      description: description?.trim() || "",
      projectId,
      assignedTo,
      status: status || "todo",
      priority: priority || "medium",
      dueDate: dueDate || null,
      createdBy: createdBy || null,
    });

    // -----------------------------
    // POPULATE
    // -----------------------------

    await task.populate([
      {
        path: "assignedTo",
        select: "name email",
      },
      {
        path: "projectId",
        select: "name",
      },
      {
        path: "createdBy",
        select: "name email",
      },
    ]);

    console.log("Task created:", task._id);

    return res.status(201).json({
      success: true,
      message: "Task assigned successfully",
      task,
    });
  } catch (error) {
    console.error("Create task error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create task",
    });
  }
};

// =========================================================
// UPDATE TASK
// =========================================================

export const updateTask = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid task ID",
      });
    }

    const {
      title,
      description,
      projectId,
      assignedTo,
      status,
      priority,
      dueDate,
    } = req.body;

    const updates = {};

    if (title !== undefined) {
      if (!title.trim()) {
        return res.status(400).json({
          success: false,
          message: "Task title is required",
        });
      }

      updates.title = title.trim();
    }

    if (description !== undefined) {
      updates.description = description.trim();
    }

    if (projectId !== undefined) {
      if (
        !projectId ||
        !mongoose.Types.ObjectId.isValid(projectId)
      ) {
        return res.status(400).json({
          success: false,
          message: "Valid project is required",
        });
      }

      updates.projectId = projectId;
    }

    if (assignedTo !== undefined) {
      if (
        !assignedTo ||
        !mongoose.Types.ObjectId.isValid(assignedTo)
      ) {
        return res.status(400).json({
          success: false,
          message: "Valid user is required",
        });
      }

      updates.assignedTo = assignedTo;
    }

    if (status !== undefined) {
      updates.status = status;
    }

    if (priority !== undefined) {
      updates.priority = priority;
    }

    if (dueDate !== undefined) {
      updates.dueDate = dueDate || null;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Nothing to update",
      });
    }

    const task = await Tasks.findByIdAndUpdate(
      id,
      updates,
      {
        new: true,
        runValidators: true,
      }
    )
      .populate("assignedTo", "name email")
      .populate("projectId", "name")
      .populate("createdBy", "name email");

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Task updated successfully",
      task,
    });
  } catch (error) {
    console.error("Update task error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update task",
    });
  }
};

// =========================================================
// DELETE TASK
// =========================================================

export const deleteTask = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid task ID",
      });
    }

    const task = await Tasks.findByIdAndDelete(id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Task deleted successfully",
    });
  } catch (error) {
    console.error("Delete task error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete task",
    });
  }
};

// =========================================================
// GET TASKS FOR USER
// =========================================================

export const getUserTasks = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const tasks = await Tasks.find({
      assignedTo: userId,
    })
      .populate("assignedTo", "name email")
      .populate("projectId", "name")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: tasks.length,
      tasks,
    });
  } catch (error) {
    console.error("Get user tasks error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load user tasks",
    });
  }
};