# SalonBook - Salon Appointment Booking Platform

## 1. Project Name and Description

**SalonBook** is a salon appointment booking platform where customers can explore salon services, view service information, and request appointments online.

Customers can manage their appointment requests, track appointment statuses, and pay for confirmed appointments through Stripe.

Administrators can manage salon services, review appointment requests, manage registered customers, and monitor payment transactions.

This repository contains the backend application built with Express.js, TypeScript, MongoDB, and REST APIs.

## 2. Important Features

### Authentication and Authorization
- Email and password authentication using Better Auth.
- Google OAuth authentication.
- JWT-based authentication and authorization.
- Role-based access control for customers and administrators.
- Blocked-user access protection.

### Service Management
- Browse available salon services.
- Search services by name.
- Filter services by category.
- Sort services by price.
- Admin service creation, updating, and deletion.
- Service image uploads using ImgBB.
- Activate and deactivate services.

### Appointment Management
- Customers can book available services.
- Appointment date and time-slot validation.
- Prevent duplicate appointment bookings.
- Customers can view and cancel their pending appointments.
- Administrators can confirm or cancel appointments.
- Appointment status management.

### Payment Management
- Stripe Checkout integration.
- Payments available for confirmed appointments.
- Stripe webhook signature verification.
- Automatic payment-status updates after verified webhook events.
- Transaction record management.

### Admin Management
- View registered customers.
- Block and unblock customer accounts.
- Manage salon services and appointments.
- View payment transactions.

## 3. Technology Stack

- **Runtime:** Node.js
- **Backend Framework:** Express.js 5
- **Programming Language:** TypeScript
- **Database:** MongoDB
- **Authentication:** Better Auth
- **Authorization:** JWT
- **API:** REST API
- **Payment Gateway:** Stripe
- **Image Hosting:** ImgBB
- **JWT Verification:** jose
- **File Upload:** Multer

## 4. Installation Instructions

Make sure Node.js and npm are installed on your computer.

Clone the server repository:

```bash
git clone https://github.com/nobin-codes/SalonBook-Server.git
```

Navigate to the project directory:

```bash
cd SalonBook-Server
```

Install the dependencies:

```bash
npm install
```

Create a `.env` file in the server root directory and configure the required environment variables listed below.

## 5. How to Run the Project Locally

Start the development server:

```bash
npm run dev
```

Build the project:

```bash
npm run build
```

Start the production server:

```bash
npm start
```

The local backend API runs at:

`http://localhost:5000`

## 6. Required Environment Variables

Create a `.env` file in the server root directory and configure these environment variable names with your own credentials.

```env
PORT
CLIENT_URL
MONGODB_URI
DB_NAME
BETTER_AUTH_SECRET
BETTER_AUTH_URL
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
IMGBB_API_KEY
```

**Security:** Never commit `.env` files, API keys, database credentials, or other sensitive information to GitHub.

## 7. Live Website Link

- **Live Website:** https://salonbook-mu.vercel.app/
- **Live Backend API:** https://salonbook-server-sooty.vercel.app/

## 8. Client and Server Repository Links

- **Client Repository:** https://github.com/nobin-codes/SalonBook-Client
- **Server Repository:** https://github.com/nobin-codes/SalonBook-Server