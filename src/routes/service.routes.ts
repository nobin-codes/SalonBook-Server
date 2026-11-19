
import { Router } from "express";
import { ObjectId } from "mongodb";
import { getDatabase } from "../config/database.js";
import {
  authenticateUser,
  authorizeAdmin,
} from "../middleware/auth.middleware.js";
import type { Service } from "../types/database.js";
import { SERVICE_CATEGORIES } from "../utils/constants.js";

const serviceRouter = Router();

const isValidObjectId = (id: string): boolean => ObjectId.isValid(id);

const getRouteId = (
  value: string | string[] | undefined,
): string | null => {
  if (typeof value !== "string" || !isValidObjectId(value)) {
    return null;
  }

  return value;
};

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const isValidService = (body: Record<string, unknown>): boolean => {
  return (
    typeof body.serviceName === "string" &&
    body.serviceName.trim().length >= 2 &&
    typeof body.category === "string" &&
    SERVICE_CATEGORIES.includes(
      body.category as (typeof SERVICE_CATEGORIES)[number],
    ) &&
    typeof body.description === "string" &&
    body.description.trim().length >= 10 &&
    typeof body.price === "number" &&
    Number.isFinite(body.price) &&
    body.price > 0 &&
    typeof body.duration === "number" &&
    Number.isInteger(body.duration) &&
    body.duration > 0 &&
    typeof body.image === "string" &&
    /^https?:\/\/\S+$/i.test(body.image.trim())
  );
};

// GET /api/services
// Public: Get active services with search, category, and price sorting.
serviceRouter.get("/", async (req, res) => {
  try {
    const db = getDatabase();

    const search =
      typeof req.query.search === "string" ? req.query.search.trim() : "";

    const category =
      typeof req.query.category === "string" ? req.query.category : "";

    const sort =
      typeof req.query.sort === "string" ? req.query.sort : "";

    const filter: Record<string, unknown> = {
      status: "active",
    };

    if (search) {
      filter.serviceName = {
        $regex: escapeRegex(search),
        $options: "i",
      };
    }

    if (category) {
      if (
        !SERVICE_CATEGORIES.includes(
          category as (typeof SERVICE_CATEGORIES)[number],
        )
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid service category.",
        });
        return;
      }

      filter.category = category;
    }

    const sortOption: Record<string, 1 | -1> =
      sort === "price-asc"
        ? { price: 1 }
        : sort === "price-desc"
          ? { price: -1 }
          : { createdAt: -1 };

    const services = await db
      .collection<Service>("services")
      .find(filter)
      .sort(sortOption)
      .toArray();

    res.status(200).json({
      success: true,
      message: "Services retrieved successfully.",
      data: services,
    });
  } catch (error) {
    console.error("Get services error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve services.",
    });
  }
});

// GET /api/services/featured
// Public: Get the newest 6 active services.
serviceRouter.get("/featured", async (_req, res) => {
  try {
    const services = await getDatabase()
      .collection<Service>("services")
      .find({ status: "active" })
      .sort({ createdAt: -1 })
      .limit(6)
      .toArray();

    res.status(200).json({
      success: true,
      message: "Featured services retrieved successfully.",
      data: services,
    });
  } catch (error) {
    console.error("Get featured services error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve featured services.",
    });
  }
});

// GET /api/services/manage
// Admin only: Get all services, including inactive services.
serviceRouter.get(
  "/manage",
  authenticateUser,
  authorizeAdmin,
  async (req, res) => {
    try {
      const search =
        typeof req.query.search === "string"
          ? req.query.search.trim()
          : "";

      const category =
        typeof req.query.category === "string"
          ? req.query.category
          : "";

      const status =
        typeof req.query.status === "string"
          ? req.query.status
          : "";

      const sort =
        typeof req.query.sort === "string"
          ? req.query.sort
          : "";

      const filter: Record<string, unknown> = {};

      if (search) {
        filter.serviceName = {
          $regex: escapeRegex(search),
          $options: "i",
        };
      }

      if (category) {
        if (
          !SERVICE_CATEGORIES.includes(
            category as (typeof SERVICE_CATEGORIES)[number],
          )
        ) {
          res.status(400).json({
            success: false,
            message: "Invalid service category.",
          });
          return;
        }

        filter.category = category;
      }

      if (status) {
        if (!["active", "inactive"].includes(status)) {
          res.status(400).json({
            success: false,
            message: "Invalid service status.",
          });
          return;
        }

        filter.status = status;
      }

      const sortOption: Record<string, 1 | -1> =
        sort === "price-asc"
          ? { price: 1 }
          : sort === "price-desc"
            ? { price: -1 }
            : { createdAt: -1 };

      const services = await getDatabase()
        .collection<Service>("services")
        .find(filter)
        .sort(sortOption)
        .toArray();

      res.status(200).json({
        success: true,
        message: "All services retrieved successfully.",
        data: services,
      });
    } catch (error) {
      console.error("Manage services error:", error);

      res.status(500).json({
        success: false,
        message: "Failed to retrieve services.",
      });
    }
  },
);

// GET /api/services/manage/:id
// Admin only: Get one service, including inactive services.
serviceRouter.get(
  "/manage/:id",
  authenticateUser,
  authorizeAdmin,
  async (req, res) => {
    try {
      const id = getRouteId(req.params.id);

      if (!id) {
        res.status(400).json({
          success: false,
          message: "Invalid service ID.",
        });
        return;
      }

      const service = await getDatabase()
        .collection<Service>("services")
        .findOne({
          _id: new ObjectId(id),
        });

      if (!service) {
        res.status(404).json({
          success: false,
          message: "Service not found.",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Service retrieved successfully.",
        data: service,
      });
    } catch (error) {
      console.error("Get service for editing error:", error);

      res.status(500).json({
        success: false,
        message: "Failed to retrieve service.",
      });
    }
  },
);

// GET /api/services/:id
// Public: Get one active service.
serviceRouter.get("/:id", async (req, res) => {
  try {
    const id = getRouteId(req.params.id);

    if (!id) {
      res.status(400).json({
        success: false,
        message: "Invalid service ID.",
      });
      return;
    }

    const service = await getDatabase()
      .collection<Service>("services")
      .findOne({
        _id: new ObjectId(id),
        status: "active",
      });

    if (!service) {
      res.status(404).json({
        success: false,
        message: "Service not found.",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Service retrieved successfully.",
      data: service,
    });
  } catch (error) {
    console.error("Get service error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve service.",
    });
  }
});

// POST /api/services
// Admin only: Create a service.
serviceRouter.post(
  "/",
  authenticateUser,
  authorizeAdmin,
  async (req, res) => {
    try {
      const body = req.body as Record<string, unknown>;

      if (!isValidService(body)) {
        res.status(400).json({
          success: false,
          message: "Please provide valid service information.",
        });
        return;
      }

      const service: Omit<Service, "_id"> = {
        serviceName: (body.serviceName as string).trim(),
        category: body.category as string,
        description: (body.description as string).trim(),
        price: body.price as number,
        duration: body.duration as number,
        image: (body.image as string).trim(),
        status: "active",
        createdAt: new Date(),
      };

      const result = await getDatabase()
        .collection<Service>("services")
        .insertOne(service as Service);

      res.status(201).json({
        success: true,
        message: "Service created successfully.",
        data: {
          ...service,
          _id: result.insertedId,
        },
      });
    } catch (error) {
      console.error("Create service error:", error);

      res.status(500).json({
        success: false,
        message: "Failed to create service.",
      });
    }
  },
);

// PATCH /api/services/:id
// Admin only: Update a service.
serviceRouter.patch(
  "/:id",
  authenticateUser,
  authorizeAdmin,
  async (req, res) => {
    try {
      const id = getRouteId(req.params.id);

      if (!id) {
        res.status(400).json({
          success: false,
          message: "Invalid service ID.",
        });
        return;
      }

      const body = req.body as Record<string, unknown>;

      const allowedFields = [
        "serviceName",
        "category",
        "description",
        "price",
        "duration",
        "image",
        "status",
      ];

      const updates: Record<string, unknown> = {};

      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          updates[field] = body[field];
        }
      }

      if (Object.keys(updates).length === 0) {
        res.status(400).json({
          success: false,
          message: "No valid fields provided for update.",
        });
        return;
      }

      const collection = getDatabase().collection<Service>("services");

      const currentService = await collection.findOne({
        _id: new ObjectId(id),
      });

      if (!currentService) {
        res.status(404).json({
          success: false,
          message: "Service not found.",
        });
        return;
      }

      const mergedService = {
        ...currentService,
        ...updates,
      };

      if (
        !isValidService(mergedService) ||
        typeof mergedService.status !== "string" ||
        !["active", "inactive"].includes(mergedService.status)
      ) {
        res.status(400).json({
          success: false,
          message: "Please provide valid service information.",
        });
        return;
      }

      const updatedService = {
        serviceName: mergedService.serviceName.trim(),
        category: mergedService.category,
        description: mergedService.description.trim(),
        price: mergedService.price,
        duration: mergedService.duration,
        image: mergedService.image.trim(),
        status: mergedService.status as "active" | "inactive",
      };

      await collection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: updatedService,
        },
      );

      res.status(200).json({
        success: true,
        message: "Service updated successfully.",
        data: {
          ...currentService,
          ...updatedService,
        },
      });
    } catch (error) {
      console.error("Update service error:", error);

      res.status(500).json({
        success: false,
        message: "Failed to update service.",
      });
    }
  },
);

// DELETE /api/services/:id
// Admin only: Permanently delete only if no appointment references exist.
serviceRouter.delete(
  "/:id",
  authenticateUser,
  authorizeAdmin,
  async (req, res) => {
    try {
      const id = getRouteId(req.params.id);

      if (!id) {
        res.status(400).json({
          success: false,
          message: "Invalid service ID.",
        });
        return;
      }

      const db = getDatabase();
      const serviceId = new ObjectId(id);

      const existingAppointment = await db
        .collection("appointments")
        .findOne({
          $or: [
            { serviceId },
            { serviceId: id },
          ],
        });

      if (existingAppointment) {
        res.status(409).json({
          success: false,
          message:
            "This service cannot be deleted because it has appointment history. Deactivate it instead.",
        });
        return;
      }

      const result = await db
        .collection<Service>("services")
        .deleteOne({
          _id: serviceId,
        });

      if (result.deletedCount === 0) {
        res.status(404).json({
          success: false,
          message: "Service not found.",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Service deleted successfully.",
      });
    } catch (error) {
      console.error("Delete service error:", error);

      res.status(500).json({
        success: false,
        message: "Failed to delete service.",
      });
    }
  },
);

export default serviceRouter;
