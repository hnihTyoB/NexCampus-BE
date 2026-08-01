# NexCampus BE - Intern Management System

Backend API service for managing interns, supervisors (leaders), tasks, submissions, evaluations, and notifications.

## Tech Stack

- **Node.js** & **Express** with **TypeScript**
- **Prisma ORM** with **PostgreSQL** (Supabase)
- **Cloudflare R2** for public file storage through its S3-compatible API
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

- Node.js (v20+; production image currently uses Node.js 22)
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

### Cloudflare R2 storage

Create one R2 bucket, enable a public custom domain (recommended) or an
`r2.dev` public URL, and create an R2 API token with Object Read & Write access
for that bucket. Configure the backend with:

```env
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET_NAME=nexcampus
R2_PUBLIC_URL=https://assets.example.com
R2_MAX_FILE_SIZE_MB=50
```

#### Where to find each R2 value

1. Open **Cloudflare Dashboard → Storage & databases → R2 → Overview**, select
   **Create bucket**, and create a bucket. Its name is `R2_BUCKET_NAME`.
2. From the R2 Overview page, copy the **Account ID** into `R2_ACCOUNT_ID`.
   The standard S3 endpoint is derived automatically as
   `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.
3. In **Account Details**, select **Manage** next to **API Tokens**, then
   **Create Account API token**. Choose **Object Read & Write** and restrict it
   to the NexCampus bucket. Copy the generated Access Key ID and Secret Access
   Key into `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`. The secret is shown
   only once.
4. Open the bucket's **Settings → Custom Domains → Add** and connect a domain
   such as `assets.example.com`. Set `R2_PUBLIC_URL=https://assets.example.com`
   without a trailing slash. The `r2.dev` development URL can be used locally,
   but is rate-limited and is not recommended for production.
5. Leave `R2_ENDPOINT` empty for a standard bucket. Copy the jurisdiction-
   specific S3 endpoint into it only for EU or FedRAMP buckets.

Official references: [R2 S3 setup](https://developers.cloudflare.com/r2/get-started/s3/),
[R2 API tokens](https://developers.cloudflare.com/r2/api/tokens/), and
[R2 public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/).

`R2_ENDPOINT` is optional and overrides the endpoint derived from
`R2_ACCOUNT_ID` (use it for jurisdiction-specific buckets). Logical object prefixes can also be overridden with
`R2_TASK_PREFIX`, `R2_SUBMISSION_PREFIX`, `R2_REPORT_PREFIX`,
`R2_AVATAR_PREFIX`, and `R2_APPLICATION_PREFIX`.

`R2_MAX_FILE_SIZE_MB=50` is the global emergency ceiling. Route-specific
policies are stricter:

| Upload type | Per-file limit | Request limit |
| --- | ---: | ---: |
| Avatar | 5 MB | 1 file |
| Daily-report attachment | 10 MB | 1 file per request, 5 per report |
| Daily-report video | 50 MB | 1 file |
| Submission attachment | 25 MB | 1 file per request, 5 per submission |
| Submission video | 5–50 MB | 1 file |
| Task attachment | 25 MB | 3 files / 75 MB per request |
| Application attachment | 10 MB | 5 files / 50 MB per request |
| Task import workbook | 10 MB | 1 `.xlsx` file |

Files are buffered in backend memory before being uploaded to R2. Do not raise
the 50 MB global ceiling without first changing large video uploads to direct
or multipart R2 uploads.

The production cleanup worker keeps using `STORAGE_CLEANUP_CRON` (default
`0 2 * * *`) and `STORAGE_CLEANUP_RETENTION_DAYS` (default `30`). It deletes
expired database records and scans each logical R2 prefix for objects that have
been orphaned for at least two hours.

Existing Supabase object URLs remain readable as legacy external URLs, but the
backend no longer deletes those objects. Before disabling Supabase Storage,
copy existing objects into the matching R2 prefixes and update persisted
`fileUrl`, `avatarUrl`, and `videoDemo` values to the new `R2_PUBLIC_URL`.

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

_Default Admin credentials:_

- **Email**: `admin@nexcampus.local`
- **Password**: `Admin@123456`

### Running the App

Start the development server:

```bash
npm run dev
```

The server runs on http://localhost:8888 by default.

---

## API Documentation

See **Swagger UI** at `http://localhost:8888/api/docs` for detailed API documentation.
