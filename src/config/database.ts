
import { MongoClient, type Db } from "mongodb";
import { env } from "./env.js";

export const mongoClient = new MongoClient(env.MONGODB_URI);

let database: Db | null = null;
let connectionPromise: Promise<Db> | null = null;

export const connectDatabase = async (): Promise<Db> => {
  if (database) {
    return database;
  }

  if (!connectionPromise) {
    connectionPromise = mongoClient
      .connect()
      .then(() => {
        database = mongoClient.db(env.DB_NAME);
        console.log(`MongoDB connected: ${env.DB_NAME}`);
        return database;
      })
      .catch((error: unknown) => {
        connectionPromise = null;
        throw error;
      });
  }

  return connectionPromise;
};

export const getDatabase = (): Db => {
  if (!database) {
    throw new Error(
      "Database is not connected. Call connectDatabase() first.",
    );
  }

  return database;
};
