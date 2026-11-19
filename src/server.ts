
import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { connectDatabase } from "./config/database.js";
import { createDatabaseIndexes } from "./config/indexes.js";
import { auth } from "./config/auth.js";
import { toNodeHandler } from "better-auth/node";
import serviceRouter from "./routes/service.routes.js";
import uploadRouter from "./routes/upload.routes.js";
import { authenticateUser } from "./middleware/auth.middleware.js";
import appointmentRouter from "./routes/appointment.routes.js";
import usersRouter from "./routes/users.routes.js";


const app = express();

app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
  }),
);

// Better Auth must be mounted before express.json().
app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(express.json());

app.use("/api/services", serviceRouter);
app.use("/api/uploads", uploadRouter);
app.use("/api/appointments", appointmentRouter); 
app.use("/api/users", usersRouter);

// Temporary JWT authentication test endpoint.
app.get("/api/test-auth", authenticateUser, (req, res) => {
  res.status(200).json({
    success: true,
    message: "JWT authentication successful!",
    user: {
      id: req.user?.id,
      name: req.user?.name,
      email: req.user?.email,
      role: req.user?.role,
    },
  });
});

app.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "SalonBook API is running successfully!",
  });
});

const startServer = async (): Promise<void> => {
  try {
    await connectDatabase();
    await createDatabaseIndexes();

    app.listen(env.PORT, () => {
      console.log(`SalonBook API running on port ${env.PORT}`);
    });
  } catch (error) {
    console.error("Failed to start SalonBook API:", error);
    process.exit(1);
  }
};

void startServer();
