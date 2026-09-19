import User from "../models/User.js";
import { firebaseAuth } from "../config/firebase.js";

// =========================================================
// CREATE USER
// POST /api/users
// =========================================================

export const createUser = async (req, res) => {
  let firebaseUser = null;

  try {
    console.log("=================================");
    console.log("CREATE USER REQUEST");
    console.log("Request body:", req.body);
    console.log("=================================");

    const {
      name,
      email,
      password,
      accessRole,
      jobRole,
      department,
      githubUsername,   // 👈 NEW
    } = req.body || {};

    // -------------------------------------------------------
    // VALIDATION
    // -------------------------------------------------------

    if (
      !name ||
      !email ||
      !password ||
      !accessRole ||
      !jobRole ||
      !department
    ) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // -------------------------------------------------------
    // CHECK MONGODB
    // -------------------------------------------------------

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    // -------------------------------------------------------
    // CHECK FIREBASE
    // -------------------------------------------------------

    try {
      firebaseUser = await firebaseAuth.getUserByEmail(normalizedEmail);

      if (firebaseUser) {
        return res.status(409).json({
          success: false,
          message: "User with this email already exists in Firebase",
        });
      }
    } catch (error) {
      if (error.code !== "auth/user-not-found") {
        throw error;
      }
    }

    // -------------------------------------------------------
    // CREATE FIREBASE USER
    // -------------------------------------------------------

    firebaseUser = await firebaseAuth.createUser({
      email: normalizedEmail,
      password,
      displayName: name.trim(),
    });

    console.log("Firebase user created:", firebaseUser.uid);

    // -------------------------------------------------------
    // CREATE MONGODB USER
    // -------------------------------------------------------

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      accessRole,
      jobRole: jobRole.trim(),
      department: department.trim(),
      githubUsername: githubUsername?.trim() || "",   // 👈 NEW
    });

    console.log("MongoDB user created:", user._id);

    // -------------------------------------------------------
    // RESPONSE
    // -------------------------------------------------------

    return res.status(201).json({
      success: true,
      message: "User created successfully",

      user: {
        _id: user._id,
        id: user._id,
        firebaseUid: firebaseUser.uid,
        name: user.name,
        email: user.email,
        accessRole: user.accessRole,
        jobRole: user.jobRole,
        department: user.department,
        githubUsername: user.githubUsername,   // 👈 NEW
        status: user.status,
      },
    });
  } catch (error) {
    console.error("=================================");
    console.error("CREATE USER ERROR");
    console.error(error);
    console.error("=================================");

    // -------------------------------------------------------
    // FIREBASE ROLLBACK
    // -------------------------------------------------------

    if (firebaseUser?.uid) {
      try {
        await firebaseAuth.deleteUser(firebaseUser.uid);
        console.log("Firebase user rolled back:", firebaseUser.uid);
      } catch (deleteError) {
        console.error("Firebase rollback failed:", deleteError.message);
      }
    }

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    if (error.code === "auth/email-already-exists") {
      return res.status(409).json({
        success: false,
        message: "User with this email already exists in Firebase",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create user",
    });
  }
};

// =========================================================
// GET ALL USERS
// GET /api/users
// =========================================================

export const getUsers = async (req, res) => {
  try {
    console.log("Get all users request");

    const users = await User.find()
      .select("-password")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    console.error("Get users error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch users",
    });
  }
};

// =========================================================
// GET USER PROFILE BY EMAIL
// GET /api/users/profile/:email
// =========================================================

export const getUserByEmail = async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email || "")
      .toLowerCase()
      .trim();

    console.log("=================================");
    console.log("GET USER PROFILE");
    console.log("Email:", email);
    console.log("=================================");

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const user = await User.findOne({ email })
      .select("-password")
      .lean();

    if (!user) {
      console.log("MongoDB profile not found:", email);

      return res.status(404).json({
        success: false,
        message: "User profile not found",
      });
    }

    console.log("MongoDB profile found:", user.email);

    return res.status(200).json({
      success: true,

      user: {
        _id: user._id,
        id: user._id,
        name: user.name,
        email: user.email,
        accessRole: user.accessRole,
        jobRole: user.jobRole,
        department: user.department,
        githubUsername: user.githubUsername || "",   // 👈 NEW
        status: user.status,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error("Get user profile error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch user profile",
    });
  }
};

// =========================================================
// UPDATE USER
// PUT /api/users/:id
// =========================================================

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      name,
      email,
      accessRole,
      jobRole,
      department,
      githubUsername,   // 👈 NEW
      status,
    } = req.body || {};

    console.log("=================================");
    console.log("UPDATE USER");
    console.log("User ID:", id);
    console.log("Request body:", req.body);
    console.log("=================================");

    // -------------------------------------------------------
    // FIND USER
    // -------------------------------------------------------

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // -------------------------------------------------------
    // VALIDATION
    // -------------------------------------------------------

    if (!name || !email || !accessRole || !jobRole || !department) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // -------------------------------------------------------
    // CHECK MONGODB EMAIL
    // -------------------------------------------------------

    const existingUser = await User.findOne({
      email: normalizedEmail,
      _id: { $ne: id },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Another user with this email already exists",
      });
    }

    // -------------------------------------------------------
    // FIND FIREBASE USER
    // -------------------------------------------------------

    let firebaseUser = null;

    try {
      firebaseUser = await firebaseAuth.getUserByEmail(user.email);
    } catch (error) {
      if (error.code !== "auth/user-not-found") {
        throw error;
      }
    }

    // -------------------------------------------------------
    // CHECK NEW FIREBASE EMAIL
    // -------------------------------------------------------

    if (firebaseUser && normalizedEmail !== user.email) {
      try {
        const existingFirebaseUser =
          await firebaseAuth.getUserByEmail(normalizedEmail);

        if (existingFirebaseUser) {
          return res.status(409).json({
            success: false,
            message:
              "Another user with this email already exists in Firebase",
          });
        }
      } catch (error) {
        if (error.code !== "auth/user-not-found") {
          throw error;
        }
      }
    }

    // -------------------------------------------------------
    // UPDATE FIREBASE
    // -------------------------------------------------------

    if (firebaseUser) {
      const firebaseUpdates = {
        displayName: name.trim(),
      };

      if (normalizedEmail !== user.email) {
        firebaseUpdates.email = normalizedEmail;
      }

      await firebaseAuth.updateUser(firebaseUser.uid, firebaseUpdates);
      console.log("Firebase user updated:", firebaseUser.uid);
    }

    // -------------------------------------------------------
    // UPDATE MONGODB
    // -------------------------------------------------------

    user.name = name.trim();
    user.email = normalizedEmail;
    user.accessRole = accessRole;
    user.jobRole = jobRole.trim();
    user.department = department.trim();

    // 👈 NEW — only update if provided
    if (githubUsername !== undefined) {
      user.githubUsername = githubUsername.trim();
    }

    if (status !== undefined) {
      user.status = status;
    }

    await user.save();

    console.log("MongoDB user updated:", user._id);

    // -------------------------------------------------------
    // RESPONSE
    // -------------------------------------------------------

    return res.status(200).json({
      success: true,
      message: "User updated successfully",

      user: {
        _id: user._id,
        id: user._id,
        name: user.name,
        email: user.email,
        accessRole: user.accessRole,
        jobRole: user.jobRole,
        department: user.department,
        githubUsername: user.githubUsername,   // 👈 NEW
        status: user.status,
      },
    });
  } catch (error) {
    console.error("Update user error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    if (error.code === "auth/email-already-exists") {
      return res.status(409).json({
        success: false,
        message: "User with this email already exists in Firebase",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update user",
    });
  }
};

// =========================================================
// DELETE USER
// DELETE /api/users/:id
// =========================================================

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    console.log("=================================");
    console.log("DELETE USER");
    console.log("User ID:", id);
    console.log("=================================");

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    let firebaseUser = null;

    try {
      firebaseUser = await firebaseAuth.getUserByEmail(user.email);
    } catch (error) {
      if (error.code !== "auth/user-not-found") {
        throw error;
      }
    }

    if (firebaseUser) {
      await firebaseAuth.deleteUser(firebaseUser.uid);
      console.log("Firebase user deleted:", firebaseUser.uid);
    }

    await User.findByIdAndDelete(id);
    console.log("MongoDB user deleted:", id);

    return res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Delete user error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete user",
    });
  }
};