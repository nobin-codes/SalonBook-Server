# SalonBook Server

**A REST API backend for the SalonBook salon appointment booking platform built with Express.js, TypeScript, MongoDB, Better Auth, Stripe, and ImgBB.**

## Overview

SalonBook Server provides the backend API for the SalonBook salon appointment booking platform. It handles authentication, service management, appointment booking, payment processing, and administrative functions.

This repository contains the **backend/server** application.

## Features

### Authentication & Authorization
- **Better Auth Integration**: Email/password registration, Google OAuth, JWT token issuance
- **JWT Verification Middleware**: Express middleware using JWKS for token validation
- **Role-Based Access Control**: Customer and Admin roles with route protection
- **Blocked User Enforcement**: Middleware blocks authenticated but blocked users
- **Secure Password Policy**: Minimum 6 characters, requires uppercase and lowercase

### Service Management
- **Public API**: Browse active services with search, category filter, price sorting
- **Admin CRUD**: Create, read, update, delete services
- **Image Upload**: ImgBB integration for service images
- **Status Control**: Activate/deactivate services (only active services visible publicly)
- **Validation**: Price > 0, duration > 0, required fields, category enum

### Appointment System
- **Booking**: Customers book active services with date/time slots
- **Duplicate Prevention**: Unique partial index prevents overlapping pending/confirmed appointments
- **Status Workflow**: Pending → Confirmed → Paid/Cancelled
- **Customer Actions**: Cancel pending appointments
- **Admin Actions**: Confirm pending, cancel pending/confirmed
- **Message Support**: Optional customer message with booking

### Payment Processing (Stripe)
- **Checkout Sessions**: Create Stripe Checkout sessions for confirmed appointments
- **Amount Validation**: Verify payment amount and currency match appointment
- **Webhook Handling**: Verified Stripe webhook signatures
- **Idempotent Transactions**: Unique stripeSessionId prevents duplicate records
- **Status Updates**: Webhook updates appointment paymentStatus and creates transaction records
- **Failure Handling**: Records failed payments, never downgrades successful ones

### Admin Functions
- **User Management**: List all users, block/unblock customers (admins protected)
- **Transaction History**: Complete payment records with customer, service, appointment details
- **Dashboard Statistics**: Aggregated counts for admin overview

### Database
- **MongoDB**: Primary database with proper indexing
- **Collections**: users (Better Auth), services, appointments, transactions
- **Indexes**: Optimized queries for services, appointments, transactions
- **References**: Proper ObjectId references between collections

## Technology Stack

- **Runtime**: Node.js (ES Modules)
- **Framework**: Express.js 5
- **Language**: TypeScript
- **Database**: MongoDB (native driver)
- **Authentication**: Better Auth 1.7 with MongoDB adapter
- **JWT Verification**: jose (JWKS-based)
- **Payments**: Stripe 23
- **Image Hosting**: ImgBB API
- **File Upload**: Multer (memory storage, 5MB limit)
- **Validation**: Custom middleware validation
- **Development**: tsx (watch mode), TypeScript 7

## Installation

```bash
# Clone the repository
git clone https://github.com/nobin-codes/SalonBook-Server.git
cd SalonBook-Server

# Install dependencies
npm install

# Copy environment template and configure
cp .env.example .env
# Edit .env with your values (NEVER commit actual secrets)
```

## Environment Variables

Create a `.env` file with the following variables (names only - never commit actual values):

```env
# Server
PORT=5000
CLIENT_URL=http://localhost:3000

# Database
MONGODB_URI=mongodb://localhost:27017
DB_NAME=salonbook

# Better Auth
BETTER_AUTH_SECRET=your_better_auth_secret
BETTER_AUTH_URL=http://localhost:5000

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Stripe
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

# ImgBB (Image Upload)
IMGBB_API_KEY=your_imgbb_api_key
```

## Running Locally

```bash
# Development server with hot reload
npm run dev

# Production build
npm run build

# Start production server
npm start
```

The API will be available at `http://localhost:5000`.

## API Endpoints

### Authentication (Better Auth)
- `POST /api/auth/sign-up/email` - Register
- `POST /api/auth/sign-in/email` - Login
- `POST /api/auth/sign-in/social` - Google OAuth
- `GET /api/auth/session` - Get session
- `POST /api/auth/sign-out` - Logout

### Services (Public)
- `GET /api/services` - List active services (search, category, sort)
- `GET /api/services/featured` - Latest 6 active services
- `GET /api/services/:id` - Get active service by ID

### Services (Admin)
- `GET /api/services/manage` - List all services (with filters)
- `GET /api/services/manage/:id` - Get any service by ID
- `POST /api/services` - Create service
- `PATCH /api/services/:id` - Update service
- `DELETE /api/services/:id` - Delete service (only if no appointments)

### Appointments
- `GET /api/appointments` - List appointments (customer: own; admin: all)
- `GET /api/appointments/:id` - Get appointment details
- `POST /api/appointments` - Create appointment (customer only)
- `PATCH /api/appointments/:id/status` - Update status (customer: cancel pending; admin: confirm/cancel)

### Payments
- `POST /api/payments/create-checkout-session` - Create Stripe Checkout session (customer)
- `GET /api/payments/transactions` - List all transactions (admin)
- `POST /api/payments/webhook` - Stripe webhook (raw body required)

### Users (Admin)
- `GET /api/users` - List all users
- `PATCH /api/users/:id/status` - Block/unblock customer

### Uploads
- `POST /api/uploads/image` - Upload image to ImgBB (authenticated)

### Health Check
- `GET /` - API status

## Database Schema

### services
```typescript
{
  _id: ObjectId,
  serviceName: string,
  category: string,        // Enum: predefined categories
  description: string,
  price: number,           // > 0
  duration: number,        // > 0, minutes
  image: string,           // ImgBB URL
  status: "active" | "inactive",
  createdAt: Date
}
```

### appointments
```typescript
{
  _id: ObjectId,
  serviceId: ObjectId,
  customerId: string,
  appointmentDate: string, // YYYY-MM-DD (Asia/Dhaka)
  timeSlot: string,        // Predefined slots
  message?: string,
  servicePrice: number,
  paymentStatus: "unpaid" | "paid",
  status: "pending" | "confirmed" | "cancelled",
  createdAt: Date
}
```

### transactions
```typescript
{
  _id: ObjectId,
  appointmentId: ObjectId,
  customerId: string,
  amount: number,
  currency: string,
  stripeSessionId: string, // Unique
  status: "paid" | "failed",
  createdAt: Date
}
```

### users (Better Auth managed)
```typescript
{
  id: string,
  name: string,
  email: string,
  image?: string,
  role: "admin" | "customer",
  isBlocked: boolean,
  phone?: string
}
```

## Indexes

- `services`: status, category, serviceName
- `appointments`: customerId+createdAt, status, appointmentDate+timeSlot (unique partial for pending/confirmed)
- `transactions`: customerId+createdAt, stripeSessionId (unique)

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project in Vercel
3. Configure environment variables in Vercel dashboard (all variables from `.env.example`)
4. Set Stripe webhook URL to: `https://your-api-domain.com/api/payments/webhook`
5. Deploy

### Other Platforms

The Express application can be deployed to any Node.js hosting:
- Build: `npm run build` (outputs to `dist/`)
- Start: `npm start` (runs `dist/server.js`)
- Ensure all environment variables are set
- Configure reverse proxy for port if needed

## Stripe Webhook Configuration

1. In Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://your-api-domain.com/api/payments/webhook`
3. Select events:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
4. Copy signing secret to `STRIPE_WEBHOOK_SECRET`

## Google OAuth Configuration

1. Google Cloud Console → APIs & Services → Credentials
2. Create OAuth 2.0 Client ID
3. Authorized redirect URIs:
   - `https://your-api-domain.com/api/auth/callback/google`
   - `http://localhost:5000/api/auth/callback/google` (dev)
4. Copy Client ID/Secret to `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`

## ImgBB Configuration

1. Create account at imgbb.com
2. Get API key from API settings
3. Add to `IMGBB_API_KEY`

## Repository

- **Server**: https://github.com/nobin-codes/SalonBook-Server
- **Client**: https://github.com/nobin-codes/SalonBook-Client

## Live Demo

- **Backend API**: https://salonbook-server-sooty.vercel.app/
- **Frontend**: https://salonbook-mu.vercel.app/

## Project Structure

```
src/
├── config/
│   ├── auth.ts           # Better Auth configuration
│   ├── database.ts       # MongoDB connection
│   ├── env.ts            # Environment validation
│   └── indexes.ts        # Database indexes
├── middleware/
│   ├── auth.middleware.ts # JWT verification + role/block checks
│   └── upload.middleware.ts # Multer config for image upload
├── routes/
│   ├── appointment.routes.ts # Appointment CRUD + status
│   ├── payment.routes.ts     # Stripe checkout + transactions
│   ├── payment-webhook.routes.ts # Stripe webhook handler
│   ├── service.routes.ts     # Service CRUD (public + admin)
│   ├── upload.routes.ts      # ImgBB image upload
│   └── users.routes.ts       # Admin user management
├── types/
│   └── database.ts       # TypeScript interfaces
├── utils/
│   └── constants.ts      # Categories, time slots, currency
└── server.ts             # Express app entry point
```

## Security Considerations

- All secrets in environment variables (never in code)
- JWT verified via JWKS (not shared secret)
- HTTP-only cookies for Better Auth sessions
- CORS restricted to configured origins
- Input validation on all mutating endpoints
- Role verification on both client and server
- Blocked user check on every authenticated request
- Stripe webhook signature verification
- Admin actions protected by authorizeAdmin middleware

## License

ISC