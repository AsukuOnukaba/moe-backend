# MoE Admin Portal — Backend Handoff for Frontend

This document is the single source of truth for rebuilding the admin frontend. The backend admin API layer is complete; all UI, routing, and client-side guards must be implemented in a separate frontend session.

**Base URL:** `http://localhost:3000` (or `process.env.VITE_API_URL` / equivalent)

**Auth header:** `Authorization: Bearer <accessToken>`

---

## Backend summary

### What already existed (verified, left intact)

| Area | Status |
|------|--------|
| `admin` role in `Role` table + Prisma schema | Present |
| Admin module (`/admin/*`) | Present |
| `AdminRoleGuard` + `JwtAuthGuard` on all admin routes | Present |
| Status fields on `ArtisanProfile` and `Product` | Present (migration `20260516120000_sprint_features`) |
| Public catalog filters (`status = approved`) | Present |
| Artisan product list returns all statuses | Present |
| `POST /auth/login` returns `user.role` | Present |
| Admin seed accounts (3 emails, `password123`) | Present in `prisma/seed.ts` |
| New artisan signup → `pending` | Present |
| New product upload → `pending` | Present |

### What was changed in this pass

| Change | Details |
|--------|---------|
| Dashboard response shape | Aligned to spec: `totalArtisans`, `artisansByStatus`, `totalProducts`, `productsByStatus`, `totalOrders` |
| Admin list filters | `GET /admin/artisans?status=`, `GET /admin/products?status=`, `GET /admin/users?role=` |
| `GET /admin/artisans/:id` | Structured response with `artisanProfile`, `businessProfile`, `user`, `productCount`, `orderCount` |
| Product status PATCH | Accepts `draft` in addition to `approved` / `rejected` |
| `AdminRoleGuard` | Returns `{ message: "Access denied", code: "FORBIDDEN" }` for non-admins |
| Exception filter | Preserves `code` from thrown exceptions (e.g. `FORBIDDEN`) |
| `PATCH /auth/change-password` | Primary route; `POST` kept as deprecated alias |
| Change password errors | Wrong current password → `400` with `{ message: "Current password is incorrect" }` |
| `FORBIDDEN` error code | Added to `ErrorCode` union |

### Migrations

No new migration was required. Status fields were added in:

- `prisma/migrations/20260516120000_sprint_features/migration.sql`

Bootstrap admin accounts (required before first admin login):

```bash
npm run seed:admins
```

Full marketplace seed (optional):

```bash
npx prisma db seed
```

---

## Authentication

### Admin login (no separate admin route)

Use the same endpoint as customers and artisans:

**`POST /auth/login`**

Request:

```json
{
  "email": "asukuonukaba@gmail.com",
  "password": "password123"
}
```

Success (`200`):

```json
{
  "token": "<jwt-access-token>",
  "refreshToken": "<jwt-refresh-token>",
  "user": {
    "id": 1,
    "username": "asukuonukaba",
    "name": "Admin User",
    "email": "asukuonukaba@gmail.com",
    "phone": null,
    "avatarUrl": null,
    "role": "admin",
    "preferences": null,
    "createdAt": "2026-01-01T00:00:00.000Z"
  }
}
```

**Frontend routing:** After login, if `user.role === 'admin'`, redirect to `/admin/dashboard`. Otherwise redirect to customer/artisan home.

### Seeded admin accounts

| Email | Password |
|-------|----------|
| `asukuonukaba@gmail.com` | `password123` |
| `tayuzeee@gmail.com` | `password123` |
| `Smartlynks97@gmail.com` | `password123` |

### Token refresh

**`POST /auth/refresh-token`**

```json
{ "refreshToken": "<refresh-token>" }
```

Returns new `{ token, refreshToken }` (no `user` object).

### Logout

**`POST /auth/logout`** — JWT required. Revokes all refresh tokens for the user.

### Change password (all authenticated users including admins)

**`PATCH /auth/change-password`** — JWT required.

Request:

```json
{
  "currentPassword": "password123",
  "newPassword": "newSecurePass1"
}
```

Success (`200`):

```json
{ "message": "Password updated successfully" }
```

Wrong current password (`400`):

```json
{ "message": "Current password is incorrect", "code": "VALIDATION_ERROR" }
```

Validation (`400`): `newPassword` must be at least 8 characters.

> **Note:** `POST /auth/change-password` still works but is deprecated.

---

## Admin endpoints

All routes below require:

1. `Authorization: Bearer <token>`
2. JWT payload `role` must be `admin`

Non-admin authenticated users receive **`403`**:

```json
{ "message": "Access denied", "code": "FORBIDDEN" }
```

Missing/invalid token receives **`401`**:

```json
{ "message": "...", "code": "AUTH_TOKEN_EXPIRED" }
```

---

### `GET /admin/dashboard`

Aggregate counts from the database.

**Response (`200`):**

```json
{
  "totalUsers": 42,
  "totalArtisans": 10,
  "artisansByStatus": {
    "pending": 2,
    "approved": 7,
    "rejected": 1
  },
  "totalProducts": 55,
  "productsByStatus": {
    "pending": 5,
    "approved": 48,
    "rejected": 2
  },
  "totalOrders": 120
}
```

> `productsByStatus` counts only `pending`, `approved`, `rejected`. Products in `draft` are included in `totalProducts` but not in the breakdown buckets.

---

### `GET /admin/artisans`

Paginated artisan list.

**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | `1` | Page number (min 1) |
| `pageSize` | number | `20` | Items per page (max 100) |
| `status` | string | — | Optional: `pending`, `approved`, `rejected` |

**Response (`200`):**

```json
{
  "data": [
    {
      "id": 5,
      "status": "pending",
      "name": "Adaobi Nwosu",
      "email": "adaobi@moe-marketplace.com",
      "brandName": "Adaobi Couture",
      "businessName": "Adaobi Couture",
      "createdAt": "2026-03-26T18:34:01.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalPages": 1,
    "totalItems": 5
  }
}
```

---

### `GET /admin/artisans/:id`

`:id` is the artisan's **user ID** (`ArtisanProfile.userId`).

**Response (`200`):**

```json
{
  "artisanProfile": {
    "userId": 5,
    "brandName": "Adaobi Couture",
    "status": "pending",
    "rejectionReason": null,
    "city": "Lagos",
    "category": "Fashion",
    "rating": 4.5,
    "reviewCount": 12,
    "createdAt": "...",
    "updatedAt": "..."
  },
  "businessProfile": {
    "businessName": "Adaobi Couture",
    "customOrdersEnabled": false,
    "rushOrderEnabled": false,
    "estimatedDeliveryDays": 7
  },
  "user": {
    "id": 5,
    "name": "Adaobi Nwosu",
    "email": "adaobi@moe-marketplace.com",
    "phone": "+234...",
    "avatarUrl": "https://...",
    "createdAt": "..."
  },
  "productCount": 4,
  "orderCount": 12
}
```

**404:** `{ "message": "Not found", "code": "RESOURCE_NOT_FOUND" }`

---

### `PATCH /admin/artisans/:id/status`

**Body:**

```json
{
  "status": "approved",
  "reason": "Optional rejection note"
}
```

| Field | Required | Values |
|-------|----------|--------|
| `status` | yes | `approved`, `rejected` |
| `reason` | no | Stored as `rejectionReason` on profile |

**Response (`200`):**

```json
{
  "id": 5,
  "status": "approved",
  "rejectionReason": null,
  "brandName": "Adaobi Couture",
  "email": "adaobi@moe-marketplace.com"
}
```

No email is sent when status changes.

---

### `GET /admin/products`

**Query params:** `page`, `pageSize`, optional `status` (`pending`, `approved`, `rejected`, `draft`)

**Response (`200`):**

```json
{
  "data": [
    {
      "id": 101,
      "status": "pending",
      "name": "Ankara Midi Dress",
      "category": "tailoring",
      "price": 25000,
      "artisan": "Adaobi Nwosu",
      "providerId": 5,
      "createdAt": "2026-03-26T18:34:01.000Z"
    }
  ],
  "pagination": { "page": 1, "pageSize": 20, "totalPages": 3, "totalItems": 55 }
}
```

---

### `GET /admin/products/:id`

Full product DTO (same shape as marketplace product, includes `status`).

**Response (`200`):** See `productToDto` — includes `id`, `name`, `description`, `priceRange`, `currency`, `images`, `category`, `providerId`, `status`, `tags`, etc.

---

### `PATCH /admin/products/:id/status`

**Body:**

```json
{
  "status": "approved",
  "reason": "Does not meet quality guidelines"
}
```

| Field | Required | Values |
|-------|----------|--------|
| `status` | yes | `approved`, `rejected`, `draft` |
| `reason` | no | Stored as `rejectionReason` |

**Response (`200`):**

```json
{
  "id": 101,
  "status": "approved",
  "rejectionReason": null,
  "name": "Ankara Midi Dress"
}
```

---

### `GET /admin/users`

**Query params:** `page`, `pageSize`, optional `role` (`admin`, `artisan`, `customer`)

**Response (`200`):**

```json
{
  "data": [
    {
      "id": 1,
      "name": "Admin User",
      "email": "asukuonukaba@gmail.com",
      "roles": ["admin"],
      "artisanStatus": null,
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "pageSize": 20, "totalPages": 1, "totalItems": 42 }
}
```

---

### `GET /admin/users/:id`

**Response (`200`):**

```json
{
  "id": 5,
  "name": "Adaobi Nwosu",
  "email": "adaobi@moe-marketplace.com",
  "phone": "+234...",
  "avatarUrl": "https://...",
  "googleId": null,
  "createdAt": "...",
  "updatedAt": "...",
  "roles": ["artisan"],
  "artisanProfile": {
    "userId": 5,
    "brandName": "Adaobi Couture",
    "businessName": "Adaobi Couture",
    "status": "approved",
    "category": "Fashion",
    "city": "Lagos",
    "state": null
  },
  "customerProfile": null
}
```

`customerProfile` is `{ addresses: [...] }` when the user has saved addresses; otherwise `null`. There is no separate `CustomerProfile` model.

Password hash is never returned.

---

## Status semantics

| Entity | Values | Default (new) | Public visibility |
|--------|--------|---------------|-------------------|
| ArtisanProfile | `pending`, `approved`, `rejected` | `pending` | Only `approved` on `/artisans`, `/service-providers/public-info`, search |
| Product | `pending`, `approved`, `rejected`, `draft` | `pending` | Only `approved` on `/products`, provider public product lists |

Artisan management (`GET /artisans/me/products`) returns **all** statuses for the owner.

---

## Required frontend routes

| Route | Purpose |
|-------|---------|
| `/admin/login` | Admin login form (uses `POST /auth/login`) |
| `/admin/dashboard` | Stats cards from `GET /admin/dashboard` |
| `/admin/artisans` | Paginated table, status filter tabs |
| `/admin/artisans/:id` | Detail view + approve/reject actions |
| `/admin/products` | Paginated table, status filter |
| `/admin/products/:id` | Detail view + approve/reject/draft actions |
| `/admin/users` | Paginated table, role filter |
| `/admin/users/:id` | User detail (roles, linked profiles) |
| `/admin/settings` or profile | Change password form |

Optional: redirect `/admin` → `/admin/dashboard`.

---

## Required frontend API layer

Create an API client module (e.g. `src/api/admin.ts`) with:

```typescript
// Example signatures — adapt to your HTTP client (fetch/axios)

adminApi.getDashboard(): Promise<DashboardStats>

adminApi.listArtisans(params: { page?: number; pageSize?: number; status?: string })
adminApi.getArtisan(id: number)
adminApi.patchArtisanStatus(id: number, body: { status: 'approved' | 'rejected'; reason?: string })

adminApi.listProducts(params: { page?: number; pageSize?: number; status?: string })
adminApi.getProduct(id: number)
adminApi.patchProductStatus(id: number, body: { status: 'approved' | 'rejected' | 'draft'; reason?: string })

adminApi.listUsers(params: { page?: number; pageSize?: number; role?: string })
adminApi.getUser(id: number)

authApi.login(email: string, password: string)
authApi.changePassword(currentPassword: string, newPassword: string)
authApi.logout()
authApi.refreshToken(refreshToken: string)
```

Attach the access token from secure storage (memory + `sessionStorage` or `localStorage` per your security model).

---

## Frontend auth guard behaviour

### On app load / route enter

1. Read stored access token.
2. If missing and route is under `/admin/*` (except `/admin/login`) → redirect to `/admin/login`.
3. Optionally decode JWT `role` claim, or call `GET /auth/profile` to confirm `role === 'admin'`.
4. If `role !== 'admin'` → clear tokens, redirect to `/admin/login` with message "Access denied".

### After login

```typescript
const { token, refreshToken, user } = await authApi.login(email, password);
if (user.role !== 'admin') {
  // Show error — do not store tokens for non-admin on admin login page
  return;
}
storeTokens(token, refreshToken);
storeUser(user);
navigate('/admin/dashboard');
```

### Logout

1. `POST /auth/logout` with Bearer token.
2. Clear tokens and user from storage.
3. Redirect to `/admin/login`.

### Token expiry

On `401` from any admin call:

1. Try `POST /auth/refresh-token` once.
2. On failure → clear session → `/admin/login`.

---

## Frontend behaviour requirements

### Dashboard

- Display stat cards: Total Users, Total Artisans (with pending badge), Total Products (with pending badge), Total Orders.
- Optional breakdown charts from `artisansByStatus` / `productsByStatus`.

### Artisans / Products tables

- Server-side pagination using `page` and `pageSize`.
- Status filter dropdown or tabs mapping to query param `status`.
- Row actions: View detail, Quick approve/reject.
- Status badges:

| Status | Suggested colour |
|--------|------------------|
| `pending` | amber/yellow |
| `approved` | green |
| `rejected` | red |
| `draft` | gray (products only) |

### Approval modals

- Approve: confirm dialog → `PATCH .../status` with `{ status: "approved" }`.
- Reject: modal with optional `reason` textarea → `{ status: "rejected", reason }`.
- Products only: "Move to draft" → `{ status: "draft" }`.

### Users table

- Role filter: All / Admin / Artisan / Customer.
- Show `roles` array as chips; `artisanStatus` when present.

### Change password

- Form: current password, new password, confirm new password (client-side match).
- `PATCH /auth/change-password` on submit.
- Show backend message on success; show `Current password is incorrect` on 400.

### Empty states

- When `pagination.totalItems === 0`, show friendly empty state (not an error).

### Loading states

- Skeleton or spinner while paginated lists load.
- Disable approve/reject buttons while PATCH is in flight.

---

## Error handling expectations

| HTTP | Code | Frontend action |
|------|------|-----------------|
| 401 | `AUTH_TOKEN_EXPIRED` | Refresh token or redirect to login |
| 403 | `FORBIDDEN` | Show "Access denied", redirect non-admins away from `/admin/*` |
| 400 | `VALIDATION_ERROR` | Show field/message errors from response |
| 404 | `RESOURCE_NOT_FOUND` | Show not found page or toast |
| 5xx | `INTERNAL_SERVER_ERROR` | Generic error toast, retry option |

All errors follow:

```json
{
  "message": "Human-readable message",
  "code": "ERROR_CODE",
  "errors": { "_errors": ["..."] }
}
```

---

## Remaining frontend TODOs

- [ ] Build `/admin/login` page (email + password, no Google-only for admin unless you add admin Google accounts)
- [ ] Implement admin layout (sidebar: Dashboard, Artisans, Products, Users, Settings)
- [ ] Implement `AdminRouteGuard` / protected route wrapper
- [ ] Build dashboard stats UI
- [ ] Build paginated artisans list + detail + approval UI
- [ ] Build paginated products list + detail + approval UI (include `draft` action)
- [ ] Build paginated users list + detail
- [ ] Build change password form
- [ ] Token storage + refresh interceptor
- [ ] Toast/notification system for API errors and success messages
- [ ] Responsive table layouts for mobile admin use

**Not in backend scope (do not expect APIs):**

- Email notifications on approve/reject
- Admin audit log
- Bulk approve/reject
- Admin-created products or users
- Separate `/auth/admin/login` route

---

## Backend limitations and assumptions

1. **Admin role priority:** Users with multiple roles resolve to `admin` first in JWT (`resolvePrimaryRole`).
2. **Artisan ID = User ID:** Admin artisan routes use `userId`, not a separate artisan table PK.
3. **No CustomerProfile model:** Customer data is user fields + addresses only.
4. **Product provider:** Products link via `providerId` (user id), not only `artisanId`.
5. **Dashboard product counts:** `productsByStatus` excludes `draft` from the three buckets; use list filter `?status=draft` for drafts.
6. **Seed idempotency:** Admin accounts are only created if email does not exist; re-running seed does not reset passwords for existing admins.
7. **CORS:** Backend reads `CORS_ORIGINS` — add your admin frontend origin before testing.
8. **JWT access TTL:** Default 20 minutes (`JWT_ACCESS_EXPIRES_IN`); implement refresh for long admin sessions.

---

## Troubleshooting admin login

### `Invalid credentials` on `POST /auth/login`

1. **Admin users missing** — Most common. The API returns the same error for unknown email and wrong password. Run:
   ```bash
   npm run seed:admins
   ```
   Ensure `DATABASE_URL` in `.env` matches the database your API uses.

2. **Wrong password** — Admins use `password123` (lowercase). Artisan demo accounts use `Password123!` (different).

3. **Database not running** — `Can't reach database server at localhost:5432` means Postgres is down; start it before seeding or starting the API.

4. **User exists but is not admin** — Re-run `npm run seed:admins`; it assigns the `admin` role and resets the dev password for the three admin emails only.

---

## Quick local test checklist

```bash
# Start DB + API
docker compose up -d
npx prisma migrate dev
npx prisma db seed
npm run start:dev

# Login
curl -s -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"asukuonukaba@gmail.com","password":"password123"}'

# Dashboard (replace TOKEN)
curl -s http://localhost:3000/admin/dashboard \
  -H "Authorization: Bearer TOKEN"
```

---

*Generated for frontend handoff. Backend-only work stops here.*
