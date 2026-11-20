
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { createAuthMiddleware, APIError } from "better-auth/api";
import { jwt } from "better-auth/plugins";
import { env } from "./env.js";
import { mongoClient } from "./database.js";

const isProduction = env.BETTER_AUTH_URL.startsWith("https://");

const trustedOrigins = Array.from(
  new Set(
    [
      env.CLIENT_URL,
      "http://localhost:3000",
      "https://salonbook-mu.vercel.app",
    ].filter(Boolean),
  ),
);

export const auth = betterAuth({
  database: mongodbAdapter(mongoClient.db(env.DB_NAME), {
    client: mongoClient,
    transaction: true,
  }),

  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,

  trustedOrigins,

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
    maxPasswordLength: 128,
  },

  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  },

  user: {
    modelName: "users",
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "customer",
        input: false,
      },
      isBlocked: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      },
      phone: {
        type: "string",
        required: false,
        input: true,
      },
    },
  },

  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },

  advanced: {
    defaultCookieAttributes: {
      sameSite: isProduction ? "none" : "lax",
      secure: isProduction,
    },
  },

  plugins: [
    jwt({
      jwt: {
        issuer: env.BETTER_AUTH_URL,
        audience: env.BETTER_AUTH_URL,
      },
    }),
  ],

  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-up/email") {
        return;
      }

      const password = ctx.body?.password;

      if (typeof password !== "string") {
        throw new APIError("BAD_REQUEST", {
          message: "Password is required.",
        });
      }

      if (!/[A-Z]/.test(password)) {
        throw new APIError("BAD_REQUEST", {
          message: "Password must contain at least one uppercase letter.",
        });
      }

      if (!/[a-z]/.test(password)) {
        throw new APIError("BAD_REQUEST", {
          message: "Password must contain at least one lowercase letter.",
        });
      }
    }),
  },
});
