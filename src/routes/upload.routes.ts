
import { Router } from "express";
import {
  authenticateUser,
  authorizeAdmin,
} from "../middleware/auth.middleware.js";
import uploadSingleImage from "../middleware/upload.middleware.js";
import { env } from "../config/env.js";

const uploadRouter = Router();

interface ImgBBResponse {
  success: boolean;
  data?: {
    url: string;
    display_url: string;
    delete_url: string;
  };
  error?: {
    message?: string;
  };
}

// POST /api/uploads/image
// Admin only: Upload an image to ImgBB.
uploadRouter.post(
  "/image",
  authenticateUser,
  authorizeAdmin,
  uploadSingleImage,
  async (req, res) => {
    try {
      if (!env.IMGBB_API_KEY) {
        res.status(503).json({
          success: false,
          message: "Image upload is not configured.",
        });
        return;
      }

      if (!req.file) {
        res.status(400).json({
          success: false,
          message: "Please select an image to upload.",
        });
        return;
      }

      const formData = new FormData();

      formData.append("image", req.file.buffer.toString("base64"));

      const response = await fetch(
        `https://api.imgbb.com/1/upload?key=${encodeURIComponent(env.IMGBB_API_KEY)}`,
        {
          method: "POST",
          body: formData,
        },
      );

      const result = (await response.json()) as ImgBBResponse;

      if (!response.ok || !result.success || !result.data?.url) {
        console.error("ImgBB upload failed:", result.error?.message);

        res.status(502).json({
          success: false,
          message: "Image hosting service could not process the upload.",
        });
        return;
      }

      res.status(201).json({
        success: true,
        message: "Image uploaded successfully.",
        data: {
          url: result.data.url,
          displayUrl: result.data.display_url,
        },
      });
    } catch (error) {
      console.error("Image upload error:", error);

      res.status(500).json({
        success: false,
        message: "Failed to upload image. Please try again.",
      });
    }
  },
);

export default uploadRouter;
