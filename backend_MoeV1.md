# Backend Requirements — MoE V1 (Frontend → Backend gap log)

> All endpoints below **require** `Authorization: Bearer <JWT>` headers.
> The frontend already attaches the access token via the existing
> `apiPost/apiGet/apiPatch/apiDelete` interceptor in `src/lib/moeApi.ts` and
> for direct `fetch` calls (image uploads) via the helper in `apiServices.ts`.
> If a new endpoint is added, do NOT introduce a new auth scheme — reuse this.

---

## 1. Artisan Profile DTO — accept structured fields

**Endpoint:** `PATCH /artisans/me`

**What:** Accept these distinct fields in the body — do **not** require them
combined into a single `location` string:

| Field         | Type   | Notes                          |
|---------------|--------|--------------------------------|
| `businessName`| string | required                       |
| `description` | string | optional                       |
| `category`    | string | one of the canonical category values |
| `country`     | string | full country name (e.g. "Nigeria") |
| `state`       | string | optional, depends on country   |
| `city`        | string | free-text                      |
| `address`     | string | street address                 |
| `storeImageUrl` | string | URL returned from upload endpoint |

**Why:** Concatenating into a single string produces unstructured data that's
painful to migrate, filter, and search later.

---

## 2. Store Image Upload

> 🔴 **STILL BROKEN** — confirmed not implemented. Frontend `POST /artisans/me/upload-image` returns `Cannot POST /artisans/me/upload-image`.

**Endpoint:** `POST /artisans/me/upload-image` (multipart/form-data, field `file`)

**Returns:** `{ "url": "https://..." }`

**Constraints validated client-side:** JPEG/PNG/WebP, ≤ 5MB.

---

## 3. Product DTO

> ⚠️ **TEST IMMEDIATELY** — frontend now sends `images: string[]` ONLY when at least one image was uploaded. If empty, the field is **omitted entirely** from the payload (not sent as `[]`). Confirm `POST /artisans/me/products` accepts a payload with `images` omitted, otherwise text-only product submissions will fail when the upload endpoint is down.

**Endpoint:** `POST /artisans/me/products` and `PATCH /artisans/me/products/:id`

**What needs to change:**

- **`price`** — accept a single number (e.g. `25000`). Drop the
  `priceRange.min/max` requirement, or make it derivable on the server.
- **`tags`** — currently sent as a comma-separated string for compatibility.
  Backend should ideally accept `string[]` directly. Either is fine; please
  document the chosen format.
- **`images`** — currently STRIPPED from the frontend payload because the
  current DTO rejects it with `property images should not exist`. Add an
  `images: string[]` field so we can re-enable the upload UI in
  `AddProductModal.tsx`. Until added, the UI shows a "Coming soon" disabled
  control to avoid silently dropping files.

---

## 4. Wishlist

> 🔴 **STILL BROKEN** — items do not persist across page refresh. The frontend correctly calls `GET/POST/DELETE /customers/me/wishlist`, but the backend appears to be using an in-memory store (Map) that is wiped on every request. **Remove the in-memory fallback and wire these endpoints to the database.**

**Endpoints:**
- `GET /customers/me/wishlist`
- `POST /customers/me/wishlist` body `{ productId }`
- `DELETE /customers/me/wishlist/:productId`

**Item shape (preferred):**
```json
{
  "id": 1, "productId": 42, "productName": "...", "providerId": 7,
  "providerName": "...", "price": 25000, "currency": "NGN",
  "category": "tailoring", "imageUrl": "...", "styleTags": ["..."],
  "addedAt": "ISO-8601"
}
```

**TEMPORARY COMPAT SHIM:** the frontend `WishlistContext` mapper currently
accepts `price`, `priceMin`, **or** `priceRange.min` and normalises to a single
`price` field. Please switch the API to return `price` directly so the shim
can be removed.

---

## 5. Addresses

> 🔴 **POSSIBLY BROKEN** — user reports `Cannot POST /customers/me/address` (note: **singular**). The frontend uses the **correct plural** `/customers/me/addresses` (verified in `src/lib/apiServices.ts`). If the backend logs show a singular `/address` route, the **backend route is registered incorrectly** — fix the backend route to be plural.

**Endpoints (all require auth):**
- `GET /customers/me/addresses` → `{ data: AddressApi[] }`
- `POST /customers/me/addresses`
- `PATCH /customers/me/addresses/:id`
- `DELETE /customers/me/addresses/:id`
- `PATCH /customers/me/addresses/:id/default`

**AddressApi shape:**
```json
{ "id": "uuid", "label": "Home", "street": "...", "city": "...",
  "state": "...", "country": "...", "isDefault": true }
```

---

## 6. Payment Methods

> 🔴 **STILL BROKEN** — `POST /customers/me/payment-methods` returns `Cannot POST /customers/me/payment-methods`. The full payment-methods module needs to be implemented per the spec below.

**Endpoints (all require auth):**
- `GET /customers/me/payment-methods` → `{ data: PaymentMethodApi[] }`
- `POST /customers/me/payment-methods`
- **`DELETE /customers/me/payment-methods/:id`** — single resource by ID.
  There is intentionally NO blanket-collection delete endpoint.
- `PATCH /customers/me/payment-methods/:id/default`

**PaymentMethodApi shape (only safe fields, NEVER raw PAN or CVV):**
```json
{
  "id": "uuid",
  "brand": "VISA",
  "last4": "4242",
  "expiry": "12/26",
  "cardholderName": "Jane Doe",
  "billingAddressId": "uuid?",
  "isDefault": true,
  "createdAt": "ISO-8601"
}
```

**🔒 TOKENISATION NOTE:** in production the frontend MUST tokenise via
Paystack/Stripe/Flutterwave before this POST and forward only the resulting
token + safe metadata. The current implementation is a placeholder for
development only — do not ship to production without integrating real
tokenisation.

---

## 7. Orders

**Endpoint:** `GET /orders`, `GET /orders/:id`

**Status:** the frontend wires to `ordersService.list()` which returns an
empty array if the endpoint is unreachable — empty state renders correctly.

**Shape mismatches are absorbed by `normalizeOrder()` in
`src/lib/apiServices.ts` (NOT in components)** — this keeps backend
inconsistencies contained to the service layer.

Currently tolerated variations:
- `productName` ←→ `product.name`
- `providerName` ←→ `provider.name` / `provider.businessName`
- `productImage` ←→ `product.images[0]`
- `price` ←→ `totalAmount` / `finalPrice`

Please align the API to the canonical `Order` interface in `apiServices.ts`
when convenient so the mapper can be simplified.

---

## Cross-cutting reminders

- **Auth:** every endpoint above requires `Authorization: Bearer <token>`.
- **CORS:** allow `PATCH` and `DELETE` from the frontend origin.
- **Errors:** return `{ message: "..." }` for non-2xx so the frontend can
  surface inline error messages on the affected forms (currently rendered
  in addition to toasts on every form per the cross-cutting rules).
