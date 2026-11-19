
import { Router } from "express";
import { ObjectId } from "mongodb";
import { getDatabase } from "../config/database.js";
import { authenticateUser } from "../middleware/auth.middleware.js";
import type {
  Appointment,
  Service,
  User,
} from "../types/database.js";
import { APPOINTMENT_TIME_SLOTS } from "../utils/constants.js";

const appointmentRouter = Router();

const getRouteId = (
  value: string | string[] | undefined,
): string | null => {
  if (typeof value !== "string" || !ObjectId.isValid(value)) {
    return null;
  }

  return value;
};

const getDhakaDate = (): string => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
};

const getDhakaMinutes = (): number => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return Number(values.hour) * 60 + Number(values.minute);
};

const getSlotStartMinutes = (timeSlot: string): number | null => {
  const match = timeSlot.match(/^(\d{2}):(\d{2}) (AM|PM) - /);

  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3];

  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) {
    return null;
  }

  const hour24 =
    period === "AM"
      ? hour === 12
        ? 0
        : hour
      : hour === 12
        ? 12
        : hour + 12;

  return hour24 * 60 + minute;
};

const isValidDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  const isValidCalendarDate =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;

  return isValidCalendarDate && value >= getDhakaDate();
};

const isPastTimeSlot = (
  appointmentDate: string,
  timeSlot: string,
): boolean => {
  if (appointmentDate !== getDhakaDate()) {
    return false;
  }

  const slotStartMinutes = getSlotStartMinutes(timeSlot);

  if (slotStartMinutes === null) {
    return true;
  }

  return slotStartMinutes <= getDhakaMinutes();
};

// GET /api/appointments
// Customer: Get own appointments.
// Admin: Get all appointments with customer and service details.
appointmentRouter.get("/", authenticateUser, async (req, res) => {
  try {
    const db = getDatabase();
    const isAdmin = req.user?.role === "admin";

    const appointments = await db
      .collection<Appointment>("appointments")
      .find(
        isAdmin
          ? {}
          : { customerId: req.user?.id },
      )
      .sort({ createdAt: -1 })
      .toArray();

    // Keep the existing customer response unchanged.
    if (!isAdmin) {
      res.status(200).json({
        success: true,
        message: "Appointments retrieved successfully.",
        data: appointments,
      });
      return;
    }

    if (appointments.length === 0) {
      res.status(200).json({
        success: true,
        message: "Appointments retrieved successfully.",
        data: [],
      });
      return;
    }

    const customerIds = [
      ...new Set(appointments.map((appointment) => appointment.customerId)),
    ];

    const validCustomerObjectIds = customerIds
      .filter((id) => ObjectId.isValid(id))
      .map((id) => new ObjectId(id));

    const serviceIds = [
      ...new Set(
        appointments.map((appointment) =>
          appointment.serviceId.toString(),
        ),
      ),
    ].map((id) => new ObjectId(id));

    const [customers, services] = await Promise.all([
      db
        .collection<User & { _id?: ObjectId }>("users")
        .find(
          {
            $or: [
              { id: { $in: customerIds } },
              { _id: { $in: validCustomerObjectIds } },
            ],
          },
          {
            projection: {
              _id: 1,
              id: 1,
              name: 1,
              email: 1,
              image: 1,
              phone: 1,
            },
          },
        )
        .toArray(),

      db
        .collection<Service>("services")
        .find({
          _id: { $in: serviceIds },
        })
        .toArray(),
    ]);

    const customerMap = new Map(
      customers.map((customer) => [
        customer.id ?? customer._id?.toString() ?? "",
        {
          id: customer.id ?? customer._id?.toString(),
          name: customer.name,
          email: customer.email,
          image: customer.image,
          phone: customer.phone,
        },
      ]),
    );

    const serviceMap = new Map(
      services.map((service) => [
        service._id.toString(),
        {
          _id: service._id,
          serviceName: service.serviceName,
          category: service.category,
          description: service.description,
          price: service.price,
          duration: service.duration,
          image: service.image,
          status: service.status,
        },
      ]),
    );

    const enrichedAppointments = appointments.map((appointment) => ({
      ...appointment,
      customer: customerMap.get(appointment.customerId) ?? null,
      service:
        serviceMap.get(appointment.serviceId.toString()) ?? null,
    }));

    res.status(200).json({
      success: true,
      message: "Appointments retrieved successfully.",
      data: enrichedAppointments,
    });
  } catch (error) {
    console.error("Get appointments error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve appointments.",
    });
  }
});

// GET /api/appointments/:id
// Customer: Get own appointment.
// Admin: Get any appointment.
appointmentRouter.get("/:id", authenticateUser, async (req, res) => {
  try {
    const id = getRouteId(req.params.id);

    if (!id) {
      res.status(400).json({
        success: false,
        message: "Invalid appointment ID.",
      });
      return;
    }

    const filter =
      req.user?.role === "admin"
        ? { _id: new ObjectId(id) }
        : {
            _id: new ObjectId(id),
            customerId: req.user?.id,
          };

    const appointment = await getDatabase()
      .collection<Appointment>("appointments")
      .findOne(filter);

    if (!appointment) {
      res.status(404).json({
        success: false,
        message: "Appointment not found.",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Appointment retrieved successfully.",
      data: appointment,
    });
  } catch (error) {
    console.error("Get appointment error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve appointment.",
    });
  }
});

// POST /api/appointments
// Customer only: Book an active service.
appointmentRouter.post("/", authenticateUser, async (req, res) => {
  try {
    if (req.user?.role !== "customer") {
      res.status(403).json({
        success: false,
        message: "Only customers can book appointments.",
      });
      return;
    }

    const { serviceId, appointmentDate, timeSlot, message } = req.body as {
      serviceId?: unknown;
      appointmentDate?: unknown;
      timeSlot?: unknown;
      message?: unknown;
    };

    if (
      typeof serviceId !== "string" ||
      !ObjectId.isValid(serviceId) ||
      typeof appointmentDate !== "string" ||
      !isValidDate(appointmentDate) ||
      typeof timeSlot !== "string" ||
      !APPOINTMENT_TIME_SLOTS.includes(
        timeSlot as (typeof APPOINTMENT_TIME_SLOTS)[number],
      ) ||
      (message !== undefined &&
        (typeof message !== "string" || message.trim().length > 500))
    ) {
      res.status(400).json({
        success: false,
        message: "Please provide valid appointment information.",
      });
      return;
    }

    if (isPastTimeSlot(appointmentDate, timeSlot)) {
      res.status(400).json({
        success: false,
        message:
          "This time slot has already started. Please choose a future time.",
      });
      return;
    }

    const db = getDatabase();

    const service = await db.collection<Service>("services").findOne({
      _id: new ObjectId(serviceId),
      status: "active",
    });

    if (!service) {
      res.status(404).json({
        success: false,
        message: "This service is unavailable or inactive.",
      });
      return;
    }

    const appointment: Omit<Appointment, "_id"> = {
      serviceId: service._id,
      customerId: req.user.id,
      appointmentDate,
      timeSlot,
      message:
        typeof message === "string" && message.trim()
          ? message.trim()
          : undefined,
      servicePrice: service.price,
      paymentStatus: "unpaid",
      status: "pending",
      createdAt: new Date(),
    };

    const result = await db
      .collection<Appointment>("appointments")
      .insertOne(appointment as Appointment);

    res.status(201).json({
      success: true,
      message: "Appointment booked successfully.",
      data: {
        ...appointment,
        _id: result.insertedId,
      },
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      res.status(409).json({
        success: false,
        message: "This time slot is already booked. Please choose another.",
      });
      return;
    }

    console.error("Create appointment error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to book appointment.",
    });
  }
});

// PATCH /api/appointments/:id/status
// Customer: Cancel own pending appointment.
// Admin: Confirm pending or cancel pending/confirmed appointments.
appointmentRouter.patch(
  "/:id/status",
  authenticateUser,
  async (req, res) => {
    try {
      const id = getRouteId(req.params.id);

      if (!id) {
        res.status(400).json({
          success: false,
          message: "Invalid appointment ID.",
        });
        return;
      }

      const { status } = req.body as {
        status?: unknown;
      };

      if (status !== "confirmed" && status !== "cancelled") {
        res.status(400).json({
          success: false,
          message: "Invalid appointment status.",
        });
        return;
      }

      const isAdmin = req.user?.role === "admin";

      if (!isAdmin && status !== "cancelled") {
        res.status(403).json({
          success: false,
          message: "Customers cannot confirm appointments.",
        });
        return;
      }

      const collection =
        getDatabase().collection<Appointment>("appointments");

      const appointmentFilter = isAdmin
        ? { _id: new ObjectId(id) }
        : {
            _id: new ObjectId(id),
            customerId: req.user?.id,
          };

      const appointment = await collection.findOne(appointmentFilter);

      if (!appointment) {
        res.status(404).json({
          success: false,
          message: "Appointment not found.",
        });
        return;
      }

      if (
        status === "confirmed" &&
        appointment.status !== "pending"
      ) {
        res.status(400).json({
          success: false,
          message: "Only pending appointments can be confirmed.",
        });
        return;
      }

      if (
        status === "cancelled" &&
        !["pending", "confirmed"].includes(appointment.status)
      ) {
        res.status(400).json({
          success: false,
          message: "This appointment cannot be cancelled.",
        });
        return;
      }

      if (!isAdmin && appointment.status !== "pending") {
        res.status(403).json({
          success: false,
          message: "You can only cancel pending appointments.",
        });
        return;
      }

      const result = await collection.updateOne(
        {
          _id: appointment._id,
          status: appointment.status,
        },
        {
          $set: { status },
        },
      );

      if (result.modifiedCount === 0) {
        res.status(409).json({
          success: false,
          message:
            "Appointment status changed. Please refresh and try again.",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: `Appointment ${status} successfully.`,
        data: {
          ...appointment,
          status,
        },
      });
    } catch (error) {
      console.error("Update appointment status error:", error);

      res.status(500).json({
        success: false,
        message: "Failed to update appointment status.",
      });
    }
  },
);

export default appointmentRouter;
