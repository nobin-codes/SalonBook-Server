
import type { Request, Response } from "express";
import Stripe from "stripe";
import { ObjectId } from "mongodb";
import { env } from "../config/env.js";
import { getDatabase } from "../config/database.js";
import type { Appointment, Transaction } from "../types/database.js";
import { DEFAULT_CURRENCY } from "../utils/constants.js";

export const handleStripeWebhook = async (
  req: Request,
  res: Response,
): Promise<void> => {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
    res.status(503).json({
      success: false,
      message: "Stripe webhook is not configured.",
    });
    return;
  }

  const signature = req.headers["stripe-signature"];

  if (typeof signature !== "string" || !Buffer.isBuffer(req.body)) {
    res.status(400).json({
      success: false,
      message: "Invalid Stripe webhook request.",
    });
    return;
  }

  let event: Stripe.Event;

  try {
    const stripe = new Stripe(env.STRIPE_SECRET_KEY);

    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (error) {
    console.error("Stripe signature verification failed:", error);

    res.status(400).json({
      success: false,
      message: "Invalid Stripe webhook signature.",
    });
    return;
  }

  try {
    const isPaidEvent =
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded";

    const isFailedEvent =
      event.type === "checkout.session.async_payment_failed";

    if (!isPaidEvent && !isFailedEvent) {
      res.status(200).json({
        received: true,
        message: "Event ignored.",
      });
      return;
    }

    const session = event.data.object as Stripe.Checkout.Session;

    const appointmentId = session.metadata?.appointmentId;
    const customerId = session.metadata?.customerId;

    if (
      session.mode !== "payment" ||
      !appointmentId ||
      !ObjectId.isValid(appointmentId) ||
      !customerId
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid payment session metadata.",
      });
      return;
    }

    const db = getDatabase();

    const appointment = await db
      .collection<Appointment>("appointments")
      .findOne({
        _id: new ObjectId(appointmentId),
        customerId,
      });

    if (!appointment) {
  if (isPaidEvent) {
    const amountInCents = session.amount_total;
    const currency = session.currency?.toLowerCase();

    if (
      session.payment_status !== "paid" ||
      !Number.isSafeInteger(amountInCents) ||
      amountInCents === null ||
      amountInCents <= 0 ||
      currency !== DEFAULT_CURRENCY.toLowerCase() ||
      !session.id
    ) {
      res.status(400).json({
        success: false,
        message: "Payment verification failed.",
      });
      return;
    }

    await db.collection<Transaction>("transactions").updateOne(
      { stripeSessionId: session.id },
      {
        $set: {
          customerId,
          amount: amountInCents / 100,
          currency,
          status: "paid",
        },
        $unset: {
          appointmentId: "",
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true },
    );

    console.warn(
      `Verified payment ${session.id} recorded without a matching appointment. Manual review required.`,
    );
  }

  res.status(200).json({
    received: true,
    message: "Appointment not found. Payment requires review.",
  });
  return;
}

    const amountInCents = Math.round(appointment.servicePrice * 100);
    const currency = DEFAULT_CURRENCY.toLowerCase();

    if (isPaidEvent) {
      if (
        session.payment_status !== "paid" ||
        session.amount_total !== amountInCents ||
        session.currency?.toLowerCase() !== currency
      ) {
        res.status(400).json({
          success: false,
          message: "Payment verification failed.",
        });
        return;
      }

      // Only confirmed, unpaid appointments can transition to paid.
      const appointmentUpdate = await db
        .collection<Appointment>("appointments")
        .updateOne(
          {
            _id: appointment._id,
            customerId,
            status: "confirmed",
            paymentStatus: "unpaid",
          },
          {
            $set: {
              paymentStatus: "paid",
            },
          },
        );

      // Record the verified Stripe payment even if the appointment
      // was cancelled or already paid. This prevents losing a real
      // payment record and keeps webhook retries idempotent.
      await db.collection<Transaction>("transactions").updateOne(
        {
          stripeSessionId: session.id,
        },
        {
          $set: {
            appointmentId: appointment._id,
            customerId,
            amount: appointment.servicePrice,
            currency: session.currency,
            status: "paid",
          },
          $setOnInsert: {
            createdAt: new Date(),
          },
        },
        {
          upsert: true,
        },
      );

      if (appointmentUpdate.matchedCount === 0) {
        console.warn(
          `Payment ${session.id} received, but appointment ${appointmentId} was not eligible for payment confirmation. Manual review may be required.`,
        );
      }
    }

    if (isFailedEvent) {
      const existingTransaction = await db
        .collection<Transaction>("transactions")
        .findOne({
          stripeSessionId: session.id,
        });

      // Never downgrade an already successful payment.
      if (existingTransaction?.status !== "paid") {
        await db.collection<Transaction>("transactions").updateOne(
          {
            stripeSessionId: session.id,
          },
          {
            $set: {
              appointmentId: appointment._id,
              customerId,
              amount: appointment.servicePrice,
              currency: session.currency ?? DEFAULT_CURRENCY,
              status: "failed",
            },
            $setOnInsert: {
              createdAt: new Date(),
            },
          },
          {
            upsert: true,
          },
        );
      }
    }

    res.status(200).json({
      success: true,
      received: true,
      message: "Stripe webhook processed successfully.",
    });
  } catch (error) {
    console.error("Stripe webhook processing error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to process Stripe webhook.",
    });
  }
};
