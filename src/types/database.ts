
import type { ObjectId } from "mongodb";

export type UserRole = "admin" | "customer";

export type ServiceStatus = "active" | "inactive";

export type AppointmentStatus = "pending" | "confirmed" | "cancelled";

export type PaymentStatus = "unpaid" | "paid";

export type TransactionStatus = "paid" | "failed";

export interface User {
  id: string;
  name: string;
  email: string;
  image?: string;
  role: UserRole;
  isBlocked: boolean;
  phone?: string;
}

export interface Service {
  _id: ObjectId;
  serviceName: string;
  category: string;
  description: string;
  price: number;
  duration: number;
  image: string;
  status: ServiceStatus;
  createdAt: Date;
}

export interface Appointment {
  _id: ObjectId;
  serviceId: ObjectId;
  customerId: string;
  appointmentDate: string;
  timeSlot: string;
  message?: string;
  servicePrice: number;
  paymentStatus: PaymentStatus;
  status: AppointmentStatus;
  createdAt: Date;
}

export interface Transaction {
  _id: ObjectId;
  appointmentId: ObjectId;
  customerId: string;
  amount: number;
  currency: string;
  stripeSessionId: string;
  status: TransactionStatus;
  createdAt: Date;
}
