# Frontend Handoff

Backend changes for the MoE feature sprint. Each section documents what the backend now does and what the frontend must implement.

## 1 — Price Range Not Saving Correctly

### What the backend now does
- `POST /artisans/me/products` and `PATCH /artisans/me/products/:id` accept `priceMin`, `priceMax`, and legacy `price` / `originalPrice`.
- On create: `price = priceMin ?? price ?? 0`, `originalPrice = priceMax ?? originalPrice ?? null`.
- On patch: `priceMin` maps to `price` (priority over `price`); `priceMax` maps to `originalPrice` (priority over `originalPrice`).
- All product responses include `priceRange: { min: number, max: number }` where `min = price` and `max = originalPrice ?? price`.

### What the frontend must do
- On artisan product create/edit forms, send `priceMin` and `priceMax` (not only `price`).
- Read `priceRange.min` and `priceRange.max` from product list/detail responses for display.
- Stop assuming `priceRange.max === priceRange.min`.

### Endpoints affected
- `POST /artisans/me/products`
- `PATCH /artisans/me/products/:id`
- `GET /products`, `GET /products/:id`, `GET /artisans/me/products`, search, and provider product listings

---

## 2 — Product Customisation Tied to Product Category

### What the backend now does
- `GET /products/customisation-template?category=shoemaking` returns category-specific fields.
- Each field: `{ key, label, type, options? }` where `type` is `select | text | number | multiselect`.
- Categories supported: `shoemaking`, `tailoring`, `leatherwork`, `canvas`, `beauty`, `crafts`.
- Order creation and customization-order creation validate submitted keys against the product category template; unknown keys return `400` with code `INVALID_CUSTOMISATION`.
- Validated customisation is stored on orders as `customisationData` (JSON object).

### What the frontend must do
- Before showing customisation UI, call `GET /products/customisation-template?category={product.category}`.
- Render fields dynamically from `fields[]` (use `type` and `options`).
- Submit customisation as `customisation` (or `customization`) object keyed by field `key` values on order/cart payloads.
- Handle `400 INVALID_CUSTOMISATION` when users submit unsupported keys.

### Endpoints affected
- `GET /products/customisation-template`
- `POST /orders` (order `items[0].customisation`)
- `POST /customization-orders`

---

## 3 — Style Tags and Filters Must Reflect Real Data

### What the backend now does
- `GET /products/filter-meta` returns live DB values:
  ```json
  {
    "categories": ["tailoring", "shoemaking"],
    "styleTags": ["Afrocentric", "Modern"],
    "priceRange": { "min": 0, "max": 500000 },
    "deliveryDays": [3, 7, 14]
  }
  ```
- `GET /artisans/filter-meta` returns:
  ```json
  {
    "categories": ["tailoring"],
    "serviceCategories": ["custom suits"],
    "locations": ["Lagos", "Abuja"]
  }
  ```
- `GET /products?styleTags=Afrocentric,Modern` filters products whose comma-separated `tags` contain each tag (case-insensitive).
- `GET /service-providers/public-info` accepts `category`, `location`, and `serviceCategories` (comma-separated or repeated) query params.

### What the frontend must do
- Replace hardcoded filter chips with values from the two `filter-meta` endpoints.
- Pass selected `styleTags` as comma-separated query param to `GET /products`.
- Pass `category`, `location`, `serviceCategories` to `GET /service-providers/public-info`.

### Endpoints affected
- `GET /products/filter-meta`
- `GET /artisans/filter-meta`
- `GET /products` (query: `styleTags`)
- `GET /service-providers/public-info` (query: `category`, `location`, `serviceCategories`)

---

## 4 — All Image Uploads Must Save to Cloud Storage

### What the backend now does
- All upload handlers upload to **Cloudinary** and return `{ "url": "https://res.cloudinary.com/..." }`.
- Local `/uploads` static serving removed from `main.ts` and `app.module.ts`.
- Required env vars: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.

### What the frontend must do
- Use `response.url` (not `imageUrl` or local `/uploads/...` paths) when saving image references.
- Configure Cloudinary credentials in deployment environment.
- `POST /artisans/me/products/upload-image` now returns `{ url }` (was `{ imageUrl }`).

### Endpoints affected
- `POST /artisans/me/products/upload-image`
- `POST /artisans/me/upload-image`
- `POST /artisans/me/upload-cover`
- `POST /auth/profile/avatar`

---

## 5 — Wishlist Must Be User-Specific and Persisted

### What the backend now does
- Wishlist is persisted per user in DB (`WishlistItem` table).
- **Idempotent add**: `POST /wishlist/:productId` returns existing product DTO if already wishlisted (no error).
- `GET /wishlist` returns full product objects via standard `productToDto` shape.
- `DELETE /wishlist/:productId` removes item (204).
- Legacy routes at `/customers/me/wishlist` remain for backward compatibility.

### What the frontend must do
- Switch wishlist API calls to JWT-protected `/wishlist` routes.
- On login, call `GET /wishlist` to hydrate wishlist state (stop using localStorage-only wishlist).
- Use `POST /wishlist/:productId` and `DELETE /wishlist/:productId` with numeric product IDs.

### Endpoints affected
- `GET /wishlist`
- `POST /wishlist/:productId`
- `DELETE /wishlist/:productId`

---

## 6 — Rush Order Must Add to Price

### What the backend now does
- `ArtisanProfile.rushOrderSurchargePercent` defaults to `25` (25% surcharge).
- Artisans configure via `PATCH /artisans/me` with `rushOrderEnabled` and `rushOrderSurchargePercent`.
- `GET /artisans/:id/rush-order-config` returns `{ rushOrderEnabled, surchargePercent }`.
- On order create with `rushOrder: true`: `basePrice`, `rushSurcharge = basePrice * (surchargePercent/100)`, `price = basePrice + rushSurcharge`.
- Returns `400 RUSH_ORDER_NOT_AVAILABLE` if artisan has `rushOrderEnabled: false`.

### What the frontend must do
- Fetch rush config before checkout UI: `GET /artisans/{providerId}/rush-order-config`.
- Show adjusted price preview: `final = basePrice * (1 + surchargePercent/100)` when rush is selected.
- Send `rushOrder: true` on order `items[0]` only when enabled.
- Display `basePrice`, `rushSurcharge`, and final `price` from order response.

### Endpoints affected
- `GET /artisans/:id/rush-order-config`
- `PATCH /artisans/me`
- `POST /orders` (body: `items[0].rushOrder`, `items[0].basePrice`)

---

## 7 — Wishlist Items Must Be Addable to Cart

### What the backend now does
- Cart add only blocks when `product.customisationRequired === true` AND no customisation payload is sent.
- Customisation payload counts if any of: `customisation`, `customization`, `measurements`, `selectedVariants`, `selectedSize`, or `selectedBodyType` is provided.
- Products with `customisationRequired: false` (default) can be added without customisation.

### What the frontend must do
- When adding wishlist items to cart, omit customisation fields unless the product requires them.
- If `customisationRequired: true` on product, collect and send customisation before `POST /customers/me/cart`.
- Handle `400 CUSTOMISATION_REQUIRED` with a prompt to complete customisation.

### Endpoints affected
- `POST /customers/me/cart`

---

## 8 — Save Card Button Must Activate and Validate Expiry

### What the backend now does
- `POST /customers/me/payment-methods` validates expiry `MM/YY` is not in the past.
- Expired cards return `400` with `{ "message": "Card has expired", "code": "CARD_EXPIRED" }`.
- Stores only `brand`, `last4`, `expiry`, `expiryMonth`, `expiryYear`, `cardholderName`, `billingAddressId`, `processorToken` — never full PAN/CVV.

### What the frontend must do
- **Critical**: store raw digits only in card number state; compute masked display at render time (do not write bullet characters into state).
- Parse expiry into `MM/YY` string for API.
- Send `processorToken` from Paystack/Stripe tokenization — never send full card number to backend.
- Enable Save Card when `last4`, `expiry`, `cardholderName`, and `brand` are valid; re-validate expiry client-side before submit.
- Show error UI for `CARD_EXPIRED`.

### Endpoints affected
- `POST /customers/me/payment-methods`

---

## 9 — Artisan Signup: Service Categories, Google OAuth, Email OTP

### What the backend now does
- `POST /auth/register` for artisans accepts `serviceCategories: string[]` (stored comma-separated on profile).
- New email/password signups: `emailVerified: false`, 6-digit OTP emailed, 15-minute expiry. Register response does **not** return tokens.
- `POST /auth/verify-email` body `{ email, otp }` — on success returns tokens + user profile.
- `POST /auth/resend-otp` body `{ email }`.
- Login returns `403 EMAIL_NOT_VERIFIED` for unverified new accounts. Existing accounts (`requiresEmailVerification: false`) are unaffected.
- Google OAuth: `GET /auth/google` → `GET /auth/google/callback` redirects to `GOOGLE_SUCCESS_REDIRECT` with `token` and `refreshToken` query params. Google users get `emailVerified: true`.

### What the frontend must do
- Artisan signup form: multi-select `serviceCategories` array in register payload.
- After register, show OTP entry screen; call `POST /auth/verify-email`.
- Add “Resend code” calling `POST /auth/resend-otp`.
- Handle login `403` code `EMAIL_NOT_VERIFIED` with redirect to verification screen.
- Add “Continue with Google” button linking to `GET /auth/google` (full-page redirect).
- On Google callback page, read `token` and `refreshToken` from URL and store session.

### Endpoints affected
- `POST /auth/register`
- `POST /auth/verify-email`
- `POST /auth/resend-otp`
- `POST /auth/login`
- `GET /auth/google`
- `GET /auth/google/callback`

---

## 10 — Artisan Accounts and Products Admin Review

### What the backend now does
- `ArtisanProfile.status`: `pending | approved | rejected` (new signups: `pending`).
- `Product.status`: `pending | approved | rejected | draft` (new products: `pending`).
- Public catalog/search/provider endpoints return only `status = approved`.
- `GET /artisans/me/products` returns all statuses for the logged-in artisan.
- Existing records migrated to `approved`.

### What the frontend must do
- Artisan dashboard: show product/account status badges (`pending`, `approved`, `rejected`).
- Hide pending/rejected products from public storefront views (backend already filters public APIs).
- Inform artisans that new listings require admin approval before appearing publicly.

### Endpoints affected
- `GET /products`, `GET /products/:id`, `GET /service-providers/public-info`, search
- `GET /artisans/me/products`
- `POST /artisans/me/products`

---

## 11 — Admin Portal with Approval Workflow and 2FA

### What the backend now does
- Seeded admin accounts (password `password123`): `asukuonukaba@gmail.com`, `tayuzeee@gmail.com`, `Smartlynks97@gmail.com`.
- Admin login: `POST /auth/login` returns `{ requiresOtp: true, email }` (no tokens until OTP).
- `POST /auth/admin/verify-otp` body `{ email, otp }` returns tokens.
- All `/admin/*` routes require JWT + `admin` role; non-admins get `403`.
- Admin endpoints:
  - `GET /admin/dashboard`
  - `GET /admin/artisans`, `GET /admin/artisans/:id`, `PATCH /admin/artisans/:id/status` body `{ status, reason? }`
  - `GET /admin/products`, `GET /admin/products/:id`, `PATCH /admin/products/:id/status` body `{ status, reason? }`
  - `GET /admin/users`, `GET /admin/users/:id`
- Approval/rejection sends email notification to artisan.

### What the frontend must do
- Build admin login: after password login, if `requiresOtp`, show OTP form and call `POST /auth/admin/verify-otp`.
- Build admin dashboard and paginated tables for artisans, products, users.
- Approval UI: PATCH status to `approved` or `rejected` with optional `reason` textarea.
- Guard all admin routes client-side by `user.role === 'admin'`.

### Endpoints affected
- `POST /auth/login`
- `POST /auth/admin/verify-otp`
- `GET /admin/dashboard`
- `GET /admin/artisans`, `GET /admin/artisans/:id`, `PATCH /admin/artisans/:id/status`
- `GET /admin/products`, `GET /admin/products/:id`, `PATCH /admin/products/:id/status`
- `GET /admin/users`, `GET /admin/users/:id`
