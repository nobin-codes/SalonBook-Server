
import { Router } from "express";
import { ObjectId } from "mongodb";
import { getDatabase } from "../config/database.js";
import {
  authenticateUser,
  authorizeAdmin,
} from "../middleware/auth.middleware.js";

const router = Router();

interface UserDocument {
  _id?: ObjectId;
  id?: string;
  name: string;
  email: string;
  image?: string;
  role: "admin" | "customer";
  isBlocked: boolean;
  phone?: string;
  createdAt?: Date;
}

// GET /api/users
// Admin only: retrieve registered users.
router.get("/", authenticateUser, authorizeAdmin, async (_req, res) => {
  try {
    const users = await getDatabase()
      .collection<UserDocument>("users")
      .find(
        {},
        {
          projection: {
            _id: 1,
            id: 1,
            name: 1,
            email: 1,
            image: 1,
            role: 1,
            isBlocked: 1,
            phone: 1,
            createdAt: 1,
          },
        },
      )
      .sort({ createdAt: -1 })
      .toArray();

    const formattedUsers = users.map((user) => ({
      id: user.id ?? user._id?.toString() ?? "",
      name: user.name,
      email: user.email,
      image: user.image,
      role: user.role,
      isBlocked: user.isBlocked,
      phone: user.phone,
      createdAt: user.createdAt,
    }));

    res.status(200).json({
      success: true,
      data: formattedUsers,
    });
  } catch (error) {
    console.error("Get users error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve users.",
    });
  }
});

// PATCH /api/users/:id/status
// Admin only: block or unblock a customer.
router.patch(
  "/:id/status",
  authenticateUser,
  authorizeAdmin,
  async (req, res) => {
    try {
      const id = req.params.id;

      if (typeof id !== "string" || !id.trim()) {
        res.status(400).json({
          success: false,
          message: "Invalid user ID.",
        });
        return;
      }

      const { isBlocked } = req.body as { isBlocked?: unknown };

      if (typeof isBlocked !== "boolean") {
        res.status(400).json({
          success: false,
          message: "A valid account status is required.",
        });
        return;
      }

      if (id === req.user?.id) {
        res.status(403).json({
          success: false,
          message: "You cannot change your own account status.",
        });
        return;
      }

      const userFilter = {
        $or: [
          { id },
          ...(ObjectId.isValid(id) ? [{ _id: new ObjectId(id) }] : []),
        ],
      };

      const usersCollection = getDatabase().collection<UserDocument>("users");

      const targetUser = await usersCollection.findOne(userFilter);

      if (!targetUser) {
        res.status(404).json({
          success: false,
          message: "User not found.",
        });
        return;
      }

      if (targetUser.role === "admin") {
        res.status(403).json({
          success: false,
          message: "Admin accounts cannot be blocked or unblocked here.",
        });
        return;
      }

      await usersCollection.updateOne(userFilter, {
        $set: { isBlocked },
      });

      res.status(200).json({
        success: true,
        message: isBlocked
          ? "Customer account blocked successfully."
          : "Customer account unblocked successfully.",
        data: {
          id: targetUser.id ?? targetUser._id?.toString() ?? id,
          isBlocked,
        },
      });
    } catch (error) {
      console.error("Update user status error:", error);

      res.status(500).json({
        success: false,
        message: "Failed to update user status.",
      });
    }
  },
);

export default router;
