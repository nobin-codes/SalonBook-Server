import { getDatabase } from "./database.js";

export const createDatabaseIndexes = async (): Promise<void> => {
  const db = getDatabase();

  await Promise.all([
    db.collection("services").createIndex({ status: 1 }),
    db.collection("services").createIndex({ category: 1 }),
    db.collection("services").createIndex({ serviceName: 1 }),
    db.collection("appointments").createIndex({ customerId: 1, createdAt: -1 }),
    db.collection("appointments").createIndex({ status: 1 }),
    db.collection("transactions").createIndex({ customerId: 1, createdAt: -1 }),
    db
      .collection("transactions")
      .createIndex({ stripeSessionId: 1 }, { unique: true }),
    db.collection("appointments").createIndex(
      { appointmentDate: 1, timeSlot: 1 },
      {
        unique: true,
        partialFilterExpression: {
          status: { $in: ["pending", "confirmed"] },
        },
      },
    ),
  ]);

  console.log("SalonBook database indexes created successfully.");
};
