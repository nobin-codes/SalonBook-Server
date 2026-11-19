
import type { Request, Response, NextFunction } from "express";
import { ObjectId } from "mongodb";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { env } from "../config/env.js";
import { getDatabase } from "../config/database.js";
import type { User } from "../types/database.js";

type UserDocument = Omit<User, "id"> & {
  id?: string;
  _id?: ObjectId;
};

const JWKS = createRemoteJWKSet(
  new URL(`${env.BETTER_AUTH_URL}/api/auth/jwks`),
);

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export const authenticateUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authorization = req.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
      return;
    }

    const token = authorization.slice(7);

    const { payload } = await jwtVerify(token, JWKS, {
      issuer: env.BETTER_AUTH_URL,
      audience: env.BETTER_AUTH_URL,
    });

    if (!payload.sub) {
      res.status(401).json({
        success: false,
        message: "Invalid authentication token.",
      });
      return;
    }

    const userDocument = await getDatabase()
      .collection<UserDocument>("users")
      .findOne({
        $or: [
          { id: payload.sub },
          ...(ObjectId.isValid(payload.sub)
            ? [{ _id: new ObjectId(payload.sub) }]
            : []),
        ],
      });

    if (!userDocument) {
      res.status(401).json({
        success: false,
        message: "User account not found.",
      });
      return;
    }

    const user: User = {
      id: userDocument.id ?? userDocument._id?.toString() ?? payload.sub,
      name: userDocument.name,
      email: userDocument.email,
      image: userDocument.image,
      role: userDocument.role,
      isBlocked: userDocument.isBlocked,
      phone: userDocument.phone,
    };

    if (user.isBlocked) {
      res.status(403).json({
        success: false,
        message: "Your account has been blocked.",
      });
      return;
    }

    req.user = user;

    next();
  } catch (error) {
    console.error("Authentication error:", error);

    res.status(401).json({
      success: false,
      message: "Invalid or expired authentication token.",
    });
  }
};

export const authorizeAdmin = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (!req.user || req.user.role !== "admin") {
    res.status(403).json({
      success: false,
      message: "Admin access required.",
    });
    return;
  }

  next();
};
