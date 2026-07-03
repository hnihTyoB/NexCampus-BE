# NexCampus BE - Intern Management System

Backend API service for managing interns, supervisors (leaders), tasks, submissions, evaluations, and notifications.

## Tech Stack
- **Node.js** & **Express** with **TypeScript**
- **Prisma ORM** with **PostgreSQL** (Supabase)
- **JWT Authentication** & **Role-Based Access Control**
- **Zod** for schema validation

---

## Database Design & Models

The system is structured around 12 core models:
1. **Role**: Represents user authorizations (`ADMIN`, `LEADER`, `INTERN`).
2. **User**: Credentials, active status, and role reference.
3. **Application**: Registry/application form details. Spawns a User account upon approval.
4. **InternProfile**: Profile details for approved interns, linking them to their corresponding `User` and supervisor (`User` with role `LEADER`).
5. **NotificationSetting**: Communication channels configuration per user.
6. **Task**: Assignments created by administrators or leaders.
7. **TaskAssignment**: Task assignations linking exactly one task to one intern.
8. **TaskSubmission**: Intern submissions containing code links (PR), video demos, notes, and reviewer comments. Supports multiple attempts.
9. **DailyReport**: Log reports written daily by interns.
10. **WeeklyEvaluation**: Evaluative scoring (communication, attitude, learning, coding, total score) performed weekly by leaders.
11. **Notification**: In-app notifications.
12. **NotificationLog**: Delivery logs tracking web, email, and Discord channel notifications.

---

## Getting Started

### Prerequisites
- Node.js (v18+)
- pnpm (recommended) or npm

### Installation
1. Clone the repository
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Set up your environment file:
   - Copy `.env.example` to `.env`
   - Fill in your connection strings and JWT keys:
     ```env
     DATABASE_URL=your_supabase_pooler_url
     DIRECT_URL=your_supabase_direct_url
     JWT_ACCESS_SECRET=your_access_secret
     JWT_REFRESH_SECRET=your_refresh_secret
     ```

### Database Initialization
Apply migrations and run the seeding script to populate initial roles and create the default admin account:
```bash
# Validate schema
npx prisma validate

# Run migrations
npx prisma migrate dev --name init_intern_mgmt

# Seed initial data (Roles & Default Admin)
npm run db:seed
```
*Default Admin credentials:*
- **Email**: `admin@nexcampus.local`
- **Password**: `Admin@123456`

### Running the App
Start the development server:
```bash
npm run dev
```

The server runs on http://localhost:3000 by default.

---

## API Endpoints

- **Auth Routing (`/api/v1/auth`)**:
  - `POST /login`: User authentication.
  - `GET /me`: Get current authenticated user details.
- **Users Routing (`/api/v1/users`)** (Admin only):
  - `GET /`: Get all users.
  - `GET /:id`: Get user details by ID.
  - `POST /`: Create a new user account.
  - `PUT /:id`: Update user details.
