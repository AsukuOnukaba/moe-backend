# backend_MoeV1.md — Backend Requirements & Gap Log
> **MoE Marketplace · Frontend → Backend Handoff**

---

## ⚠️ CRITICAL — READ FIRST

- Every endpoint in this document requires: `Authorization: Bearer <JWT>`
- The frontend attaches this automatically via the interceptor in `src/lib/moeApi.ts`.
- **DO NOT** introduce a new auth scheme — reuse the existing interceptor for all new endpoints.
- CORS must allow `PATCH` and `DELETE` from the frontend origin.
- All non-2xx responses **must** return `{ "message": "Human-readable error string" }` so the frontend can surface inline form errors on the affected field, not just a disappearing toast.

---

## Sections

1. [Artisan Profile DTO](#1-artisan-profile-dto)
2. [Store Image Upload](#2-store-image-upload)
3. [Product DTO](#3-product-dto)
4. [Wishlist Endpoints](#4-wishlist-endpoints)
5. [Address Endpoints](#5-address-endpoints)
6. [Payment Method Endpoints](#6-payment-method-endpoints)
7. [Orders Endpoints](#7-orders-endpoints)
8. [Cross-Cutting Requirements](#8-cross-cutting-requirements)

---

## 1. Artisan Profile DTO

**Endpoint:** `PATCH /artisans/me`

### Problem
`PATCH /artisans/me` currently rejects `businessName`, `description`, `country`, `state`, `city`, and `address` with `"property X should not exist"` validation errors. The frontend cannot save any profile changes until the DTO is updated.

### Required DTO Changes
Accept all fields below as **optional individual fields**. Do **NOT** require them concatenated into a single `location` string — structured fields are essential for filtering, search, and future data migration.

| Field           | Type   | Required | Notes                                                                 |
|----------------|--------|----------|-----------------------------------------------------------------------|
| `businessName`  | string | Yes      | Artisan business display name                                         |
| `description`   | string | No       | Bio / about text                                                      |
| `category`      | string | No       | Must be one of the canonical category enum values                     |
| `country`       | string | No       | Full country name e.g. `"Nigeria"`                                    |
| `state`         | string | No       | State / province within the country                                   |
| `city`          | string | No       | Free-text city name                                                   |
| `address`       | string | No       | Street address                                                        |
| `storeImageUrl` | string | No       | URL returned from the upload endpoint — see overwrite rule below      |

> **`storeImageUrl` overwrite rule:** This is a single string — one store image per artisan profile. Uploading a new image **overwrites** the previous value. Do not store as an array.

### Checklist
- [ ] Update artisan profile DTO to accept all fields in the table above
- [ ] Remove `"should not exist"` validators for `businessName` and `description`
- [ ] Confirm `category` validates against canonical enum
- [ ] Confirm `storeImageUrl` overwrites (does not append)

---

## 2. Store Image Upload

**Endpoint:** `POST /artisans/me/upload-image`
**Content-Type:** `multipart/form-data` · Field name: `file`

### Client-Side Validation (frontend enforces before upload)
- Accepted MIME types: `image/jpeg`, `image/png`, `image/webp`
- Maximum file size: **5 MB**

### Response (200 OK)
```json
{ "url": "https://cdn.example.com/artisans/store-images/abc123.jpg" }
```

### Flow
1. Frontend uploads file → receives `{ url }`
2. Frontend then `PATCH`es `/artisans/me` with `{ storeImageUrl: url }`
3. Both requests use the same Bearer token interceptor

### Error Responses
- `413` + `{ "message": "File too large. Maximum size is 5MB." }` for oversized files
- `415` + `{ "message": "Unsupported file type. Upload a JPEG, PNG, or WebP image." }` for invalid MIME types

### Checklist
- [ ] Create `POST /artisans/me/upload-image` endpoint
- [ ] Store file to CDN / S3 / Cloudinary and return a permanent URL
- [ ] Reject files > 5 MB with `413`
- [ ] Reject invalid MIME types with `415`

---

## 3. Product DTO

**Endpoints:** `POST /artisans/me/products` · `PATCH /artisans/me/products/:id`

### Current Validation Errors (frontend currently receives)
- `"property priceRange should not exist"`
- `"property images should not exist"`
- `"price must not be less than zero"`
- `"price must be a number conforming to constraints"`
- `"tags must be a string"`

### Required Changes

| Field         | Type              | Notes                                                                                     |
|--------------|-------------------|-------------------------------------------------------------------------------------------|
| `price`       | number (positive) | Single price value. Drop `priceRange` entirely — do not require min/max.                 |
| `tags`        | string (CSV)      | Frontend sends comma-separated string e.g. `"handmade,leather,belt"`. See note below.    |
| `images`      | string[]          | Currently **stripped** from payload because DTO rejects it. Add this to re-enable upload UI. |
| `name`        | string            | Required                                                                                  |
| `description` | string            | Required                                                                                  |
| `category`    | string            | Must match canonical category enum                                                        |

> **⚠️ Tags format — decision required:** The frontend currently sends `tags` as a CSV string for compatibility. If the backend prefers `string[]` instead, update this document and **notify the frontend team** so `AddProductModal.tsx` can be adjusted. Do not change silently — a mismatch will cause tags to be saved incorrectly.

> **ℹ️ `images` field (currently disabled on frontend):** The image upload control in `AddProductModal.tsx` is disabled with a `"Coming soon"` badge until the backend accepts `images: string[]`. Once this DTO change ships, **notify the frontend team** so the upload UI can be re-enabled. The frontend is not waiting on any other change for this.

### Checklist
- [ ] Replace `priceRange` with a single `price` field (number, must be > 0)
- [ ] Accept `images: string[]` in the product DTO
- [ ] Accept `tags` as CSV string (or align format — see warning above)
- [ ] Notify frontend when `images` field is accepted so upload UI can be re-enabled

---

## 4. Wishlist Endpoints

**Endpoints:**
- `GET /customers/me/wishlist`
- `POST /customers/me/wishlist`
- `DELETE /customers/me/wishlist/:productId`

### Current Issue
Wishlist items disappear on page refresh. The frontend was using local component state. It has now been wired to these endpoints — they must exist and persist to the database.

### GET — Response Shape (preferred)
```json
{
  "data": [
    {
      "id": 1,
      "productId": 42,
      "productName": "Handmade Leather Belt",
      "providerId": 7,
      "providerName": "Adeola Crafts",
      "price": 25000,
      "currency": "NGN",
      "category": "leatherwork",
      "imageUrl": "https://...",
      "styleTags": ["handmade", "leather"],
      "addedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 1
}
```

### POST — Request Body
```json
{ "productId": 42 }
```

> **⚠️ Temporary compatibility shim (to be removed):** The `WishlistContext` mapper currently accepts `price`, `priceMin`, **or** `priceRange.min` and normalises all variants to a single `price` field. This shim exists because the current API returns `priceRange.min` instead of `price`. Once the API returns `price` directly, this shim will be deleted. **Please switch the API to return `price` (not `priceRange`) as soon as possible.**

> **ℹ️ Pagination envelope:** Return `{ data: [], total: N }` now — even if `?page` and `?limit` parameters are not yet implemented. This future-proofs the endpoint for pagination without a breaking change later.

### Checklist
- [ ] Implement `GET /customers/me/wishlist` returning `{ data: [], total: N }`
- [ ] Implement `POST /customers/me/wishlist` with `{ productId }`
- [ ] Implement `DELETE /customers/me/wishlist/:productId`
- [ ] Return `price` (not `priceRange`) in item shape so the frontend shim can be removed
- [ ] Persist to database — not in-memory or session storage

---

## 5. Address Endpoints

**Endpoints:**
- `GET /customers/me/addresses`
- `POST /customers/me/addresses`
- `PATCH /customers/me/addresses/:id`
- `DELETE /customers/me/addresses/:id`
- `PATCH /customers/me/addresses/:id/default` *(confirm frontend uses this before implementing — see note)*

### Current Issue
Attempting to save an address returns: `Cannot POST /customers/me/addresses`. This endpoint either does not exist or is not routed correctly.

### AddressApi Shape
```json
{
  "data": [
    {
      "id": "uuid",
      "label": "Home",
      "street": "14 Adeola Odeku St",
      "city": "Lagos",
      "state": "Lagos State",
      "country": "Nigeria",
      "isDefault": true
    }
  ],
  "total": 1
}
```

> **⚠️ Confirm `/default` endpoint before implementing:** `PATCH /customers/me/addresses/:id/default` has been added to this spec. Before implementing it, confirm the frontend `Settings.tsx` address UI actually includes a "Set as default" action. Do not implement unused endpoints.

### Checklist
- [ ] Create `POST /customers/me/addresses` (fix the `"Cannot POST"` error)
- [ ] Implement `GET` returning `{ data: [], total: N }` envelope
- [ ] Implement `PATCH /addresses/:id` for edits
- [ ] Implement `DELETE /addresses/:id`
- [ ] Confirm and implement `PATCH /addresses/:id/default` only if frontend UI supports it
- [ ] All addresses persist to database

---

## 6. Payment Method Endpoints

**Endpoints:**
- `GET /customers/me/payment-methods`
- `POST /customers/me/payment-methods`
- `DELETE /customers/me/payment-methods/:id`
- `PATCH /customers/me/payment-methods/:id/default` *(confirm frontend uses this before implementing — see note)*

### Current Issue
Payment methods disappear on page refresh — no persistence to backend.

### PaymentMethodApi Shape — Safe Fields Only
```json
{
  "data": [
    {
      "id": "uuid",
      "brand": "VISA",
      "last4": "4242",
      "expiry": "12/26",
      "cardholderName": "Jane Doe",
      "billingAddressId": "uuid or null",
      "isDefault": true,
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 1
}
```

> **🔴 DELETE is by ID — no blanket collection delete:** `DELETE /customers/me/payment-methods/:id` removes a **single** resource. There is intentionally **no** endpoint that deletes the entire collection. The `:id` parameter is mandatory — reject requests without it.

> **🔴 TOKENISATION — DO NOT SHIP RAW TO PRODUCTION:** The current implementation forwards only safe fields (`last4`, `brand`, `expiry`, `cardholderName`). In production, the frontend **must** tokenise via Paystack / Stripe / Flutterwave first and send only the resulting token + safe metadata. Raw PANs and CVVs must **never** reach your server. This is a development placeholder only — do not go live without real tokenisation.

> **⚠️ Confirm `/default` endpoint before implementing:** Same note as addresses — confirm the payment UI has a "Set as default" action before implementing `PATCH /payment-methods/:id/default`.

### Checklist
- [ ] Implement `GET /customers/me/payment-methods` → `{ data: [], total: N }`
- [ ] Implement `POST /customers/me/payment-methods` (safe fields only)
- [ ] Implement `DELETE /customers/me/payment-methods/:id` (single resource — never the collection)
- [ ] Confirm and implement `PATCH /payment-methods/:id/default` only if frontend UI supports it
- [ ] Persist to database — not in-memory
- [ ] Integrate Paystack / Stripe tokenisation before production launch

---

## 7. Orders Endpoints

**Endpoints:** `GET /orders` · `GET /orders/:id`

### Status
The frontend `ordersService.list()` gracefully returns an empty array if the endpoint is unreachable — the empty state renders correctly and does not crash. However, a genuine endpoint failure and a real empty orders list look identical to the user.

> **⚠️ Distinguish empty vs error in production:** A successful `200 []` (no orders yet) and a `404`/`503` (broken endpoint) both show an empty list. Once the endpoint exists, return proper error status codes so the frontend can show an error state vs a genuine empty state.

### Shape Mismatches — Handled in Service Layer
Shape variations from the API are normalised by `normalizeOrder()` in `src/lib/apiServices.ts` — **not** in UI components. This keeps backend inconsistencies contained to the service layer. Currently tolerated variations:

| API Field                          | Frontend Canonical Field | Notes                      |
|-----------------------------------|--------------------------|----------------------------|
| `product.name`                    | `productName`            | Nested vs flat             |
| `provider.name` / `businessName`  | `providerName`           | Two possible nested paths  |
| `product.images[0]`               | `productImage`           | First image from array     |
| `totalAmount` / `finalPrice`      | `price`                  | Two possible field names   |

> **ℹ️ Mapper removal goal:** Please align the API response to the canonical `Order` interface in `apiServices.ts` when convenient so `normalizeOrder()` can be simplified or removed. Low priority — the shim works correctly in the meantime.

### Checklist
- [ ] Verify `GET /orders` and `GET /orders/:id` exist and return data
- [ ] Return `200 []` for no orders (not `404`)
- [ ] Return `404`/`503` for genuine errors so the frontend can distinguish them
- [ ] Align response shape to canonical `Order` interface when possible (removes the mapper)

---

## 8. Cross-Cutting Requirements

### Authentication
Every endpoint in this document requires:
```
Authorization: Bearer <JWT>
```
The frontend attaches this via the interceptor in `src/lib/moeApi.ts`. All new service methods added to `src/lib/apiServices.ts` use this interceptor — no bespoke fetch calls with manual headers.

### CORS
- Allow `PATCH` and `DELETE` methods from the frontend origin
- Allow `Content-Type: multipart/form-data` for the image upload endpoint
- Allow the `Authorization` header on all routes

### Error Response Shape
All non-2xx responses must return:
```json
{ "message": "Human-readable description of the error" }
```
This allows the frontend to display inline form errors on the affected field in addition to toast notifications. Generic HTTP status text is not sufficient.

### Pagination Envelope
All list endpoints (`wishlist`, `addresses`, `payment-methods`, `orders`) must return:
```json
{
  "data": [ "...items" ],
  "total": 42
}
```
Return this envelope now, even if `?page` and `?limit` parameters are not yet implemented. This prevents a breaking API change when pagination is added later.

### Master Checklist
- [ ] All endpoints enforce `Authorization: Bearer <JWT>`
- [ ] `PATCH` and `DELETE` are allowed in CORS policy
- [ ] All non-2xx responses return `{ "message": "..." }`
- [ ] All list endpoints return `{ data: [], total: N }` envelope
- [ ] No raw PAN or CVV stored anywhere — tokenisation integrated before production launch

---

*End of backend_MoeV1.md — update this file as items are completed.*
