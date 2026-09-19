import User from "../models/User.js";
import Project from "../models/Project.js";
import Tasks from "../models/Tasks.js";

export const getDashboardStats = async (req, res) => {
  try {
    const [
      totalUsers,
      totalProjects,
      activeTasks,
      completedTasks,
    ] = await Promise.all([
      User.countDocuments(),
      Project.countDocuments(),
      Tasks.countDocuments({
        status: { $in: ["todo", "in-progress", "review"] },
      }),
      Tasks.countDocuments({
        status: "completed",
      }),
    ]);

    return res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        totalProjects,
        activeTasks,
        completedTasks,
      },
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load dashboard statistics",
      error: error.message,
    });
  }
};