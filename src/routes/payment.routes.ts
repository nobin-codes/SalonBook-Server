
import { Router } from "express";
import Stripe from "stripe";
import { ObjectId } from "mongodb";
import { env } from "../config/env.js";
import { getDatabase } from "../config/database.js";
import {
  authenticateUser,
  authorizeAdmin,
} from "../middleware/auth.middleware.js";
import type {
  Appointment,
  Service,
  Transaction,
  User,
} from "../types/database.js";
import { DEFAULT_CURRENCY } from "../utils/constants.js";

const router = Router();

// Create a Stripe Checkout session for a confirmed appointment.
router.post(
  "/create-checkout-session",
  authenticateUser,
  async (req, res): Promise<void> => {
    try {
      const user = req.user;

      if (!user || user.role !== "customer") {
        res.status(403).json({
          success: false,
          message: "Only customers can make payments.",
        });
        return;
      }

      const { appointmentId } = req.body as {
        appointmentId?: string;
      };

      if (!appointmentId || !ObjectId.isValid(appointmentId)) {
        res.status(400).json({
          success: false,
          message: "A valid appointment ID is required.",
        });
        return;
      }

      if (!env.STRIPE_SECRET_KEY) {
        res.status(503).json({
          success: false,
          message: "Payment service is not configured.",
        });
        return;
      }

      const stripe = new Stripe(env.STRIPE_SECRET_KEY);
      const db = getDatabase();

      const appointment = await db
        .collection<Appointment>("appointments")
        .findOne({
          _id: new ObjectId(appointmentId),
          customerId: user.id,
        });

      if (!appointment) {
        res.status(404).json({
          success: false,
          message: "Appointment not found.",
        });
        return;
      }

      if (appointment.status !== "confirmed") {
        res.status(400).json({
          success: false,
          message: "Only confirmed appointments can be paid.",
        });
        return;
      }

      if (appointment.paymentStatus === "paid") {
        res.status(400).json({
          success: false,
          message: "This appointment has already been paid.",
        });
        return;
      }

      const service = await db
        .collection<Service>("services")
        .findOne({ _id: appointment.serviceId });

      if (!service) {
        res.status(404).json({
          success: false,
          message: "Service information not found.",
        });
        return;
      }

      const amountInCents = Math.round(
        appointment.servicePrice * 100,
      );

      if (!Number.isSafeInteger(amountInCents) || amountInCents <= 0) {
        res.status(400).json({
          success: false,
          message: "Invalid appointment payment amount.",
        });
        return;
      }

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: user.email,
        line_items: [
          {
            price_data: {
              currency: DEFAULT_CURRENCY,
              product_data: {
                name: service.serviceName,
                description: `Appointment on ${appointment.appointmentDate}, ${appointment.timeSlot}`,
              },
              unit_amount: amountInCents,
            },
            quantity: 1,
          },
        ],
        metadata: {
          appointmentId: appointment._id.toString(),
          customerId: user.id,
        },
        success_url: `${env.CLIENT_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${env.CLIENT_URL}/payment/cancel`,
      });

      if (!session.url) {
        res.status(500).json({
          success: false,
          message: "Unable to generate the Stripe checkout URL.",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Checkout session created successfully.",
        data: {
          checkoutUrl: session.url,
        },
      });
    } catch (error) {
      console.error("Create checkout session error:", error);

      res.status(500).json({
        success: false,
        message: "Failed to create payment session.",
      });
    }
  },
);

// Retrieve all transactions. Admin access only.
router.get(
  "/transactions",
  authenticateUser,
  authorizeAdmin,
  async (_req, res): Promise<void> => {
    try {
      const db = getDatabase();

      const transactions = await db
        .collection<Transaction>("transactions")
        .find({})
        .sort({ createdAt: -1 })
        .toArray();

      const transactionDetails = await Promise.all(
        transactions.map(async (transaction) => {
          const [appointment, customer] = await Promise.all([
            db.collection<Appointment>("appointments").findOne({
              _id: transaction.appointmentId,
            }),
            db.collection<User>("users").findOne({
              $or: [
                { id: transaction.customerId },
                ...(ObjectId.isValid(transaction.customerId)
                  ? [{ _id: new ObjectId(transaction.customerId) }]
                  : []),
              ],
            }),
          ]);

          let service: Service | null = null;

          if (appointment) {
            service = await db
              .collection<Service>("services")
              .findOne({
                _id: appointment.serviceId,
              });
          }

          return {
            ...transaction,
            customer: customer
              ? {
                  id: customer.id ?? customer._id?.toString() ?? "",
                  name: customer.name,
                  email: customer.email,
                }
              : null,
            appointment: appointment
              ? {
                  _id: appointment._id,
                  appointmentDate: appointment.appointmentDate,
                  timeSlot: appointment.timeSlot,
                  status: appointment.status,
                  paymentStatus: appointment.paymentStatus,
                }
              : null,
            service: service
              ? {
                  _id: service._id,
                  serviceName: service.serviceName,
                  category: service.category,
                }
              : null,
          };
        }),
      );

      res.status(200).json({
        success: true,
        message: "Transactions retrieved successfully.",
        data: transactionDetails,
      });
    } catch (error) {
      console.error("Get transactions error:", error);

      res.status(500).json({
        success: false,
        message: "Failed to retrieve transactions.",
      });
    }
  },
);

export default router;
