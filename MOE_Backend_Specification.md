# MOE Platform — Backend Specification Document

**Version:** 1.0  
**Date:** 2026-03-26  
**Purpose:** Complete backend blueprint derived from the MOE React frontend implementation.  
**Base URL:** `https://api.moe-africa.com`  
**Recommended Stack:** Laravel PHP with Sanctum authentication

---

## Table of Contents

1. [Authentication System](#1-authentication-system)
2. [API Modules & Endpoints](#2-api-modules--endpoints)
   - 2.1 [Auth](#21-auth)
   - 2.2 [Customer Profile & Preferences](#22-customer-profile--preferences)
   - 2.3 [Products](#23-products)
   - 2.4 [Product Variants](#24-product-variants)
   - 2.5 [Service Providers](#25-service-providers)
   - 2.6 [Reviews](#26-reviews)
   - 2.7 [Orders](#27-orders)
   - 2.8 [Customization Orders](#28-customization-orders)
   - 2.9 [Custom Order Requests (Bespoke)](#29-custom-order-requests-bespoke)
   - 2.10 [Payments](#210-payments)
   - 2.11 [Cart](#211-cart)
   - 2.12 [Wishlist](#212-wishlist)
   - 2.13 [Messaging](#213-messaging)
   - 2.14 [Notifications](#214-notifications)
   - 2.15 [Search](#215-search)
   - 2.16 [Support Tickets](#216-support-tickets)
   - 2.17 [Media Upload](#217-media-upload)
   - 2.18 [Admin](#218-admin)
3. [Database Schema](#3-database-schema)
4. [Authentication & Authorization Design](#4-authentication--authorization-design)
5. [Error Handling](#5-error-handling)
6. [Pagination Convention](#6-pagination-convention)
7. [Security Best Practices](#7-security-best-practices)
8. [Scalability & Infrastructure](#8-scalability--infrastructure)
9. [Logging & Monitoring](#9-logging--monitoring)

---

## 1. Authentication System

### Token Flow

```
1. User submits POST /auth/login { email, password }
2. Backend validates credentials, returns:
   { token: "<jwt>", refreshToken: "<refresh_jwt>", user: CustomerProfile }
3. Frontend stores tokens:
   - localStorage key "moe_access_token" → JWT access token
   - localStorage key "moe_refresh_token" → refresh token
4. All authenticated requests include header:
   Authorization: Bearer <access_token>
5. On 401 response, frontend calls POST /auth/refresh-token { refreshToken }
6. Backend validates refresh token, issues new pair
7. If refresh fails, user is logged out
```

### Token Specifications

| Property | Value |
|---|---|
| Access token lifetime | 15–30 minutes |
| Refresh token lifetime | 7–30 days |
| Algorithm | HS256 or RS256 |
| Token payload (claims) | `sub` (user ID), `email`, `role`, `iat`, `exp` |
| Auth header format | `Authorization: Bearer <token>` (configurable via `VITE_MOE_AUTH_PREFIX`) |

### Laravel Implementation

Use **Laravel Sanctum** with API token abilities or a JWT package (`tymon/jwt-auth`). The frontend expects:
- JSON responses (no redirects)
- Token-based auth (not session/cookie-based, though httpOnly cookies are acceptable if CORS is configured)

---

## 2. API Modules & Endpoints

### Standard Response Envelope

All list endpoints return:
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalPages": 5,
    "totalItems": 100
  }
}
```

Single-resource endpoints return the object directly (no envelope).

---

### 2.1 Auth

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | No | Create new customer account |
| POST | `/auth/login` | No | Authenticate and receive tokens |
| POST | `/auth/logout` | Yes | Invalidate current tokens |
| POST | `/auth/refresh-token` | No | Exchange refresh token for new token pair |
| GET | `/auth/profile` | Yes | Get current user's profile |
| POST | `/auth/forgot-password` | No | Send password reset email |
| POST | `/auth/reset-password` | No | Reset password with token |

#### `POST /auth/register`
**Request:**
```json
{
  "name": "string (required)",
  "email": "string (required, unique)",
  "password": "string (required, min 8 chars)",
  "phone": "string (optional)"
}
```
**Response (201):**
```json
{
  "token": "jwt_access_token",
  "refreshToken": "jwt_refresh_token",
  "user": { CustomerProfile }
}
```

#### `POST /auth/login`
**Request:**
```json
{
  "email": "string (required)",
  "password": "string (required)"
}
```
**Response (200):** Same as register response.

#### `POST /auth/refresh-token`
**Request:**
```json
{
  "refreshToken": "string (required)"
}
```
**Response (200):**
```json
{
  "token": "new_access_token",
  "refreshToken": "new_refresh_token"
}
```

#### `GET /auth/profile`
**Response (200):** `CustomerProfile` object.

---

### 2.2 Customer Profile & Preferences

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/auth/profile` | Yes | Get profile |
| PATCH | `/auth/profile` | Yes | Update profile fields |
| GET | `/customers/me/preferences` | Yes | Get personalization preferences |
| POST | `/customers/me/preferences` | Yes | Create/update preferences |
| DELETE | `/customers/me/preferences` | Yes | Clear preferences |
| GET | `/customers/me/addresses` | Yes | List saved addresses |
| POST | `/customers/me/addresses` | Yes | Add address |
| PATCH | `/customers/me/addresses/{id}` | Yes | Update address |
| DELETE | `/customers/me/addresses/{id}` | Yes | Delete address |
| GET | `/customers/me/payment-methods` | Yes | List saved payment methods |
| POST | `/customers/me/payment-methods` | Yes | Add payment method |
| DELETE | `/customers/me/payment-methods/{id}` | Yes | Remove payment method |

#### `CustomerProfile` Schema
```json
{
  "id": "number",
  "username": "string",
  "name": "string",
  "email": "string",
  "phone": "string | null",
  "avatarUrl": "string | null",
  "preferences": "UserPreference | null",
  "createdAt": "ISO 8601 string"
}
```

#### `UserPreference` Schema
```json
{
  "id": "number",
  "userId": "number",
  "categories": ["tailoring", "shoemaking"],
  "styleTags": ["Modern", "Afrocentric"],
  "budget": 500000,
  "updatedAt": "ISO 8601 string"
}
```

#### `Address` Schema
```json
{
  "id": "number",
  "label": "string (e.g. Home, Office)",
  "street": "string",
  "city": "string",
  "state": "string",
  "country": "string",
  "isDefault": "boolean"
}
```

---

### 2.3 Products

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/products` | No | List/filter/search products |
| GET | `/products/{id}` | No | Get single product |
| GET | `/products/recommendations` | No* | Get personalized recommendations |
| GET | `/service-providers/{id}/products` | No | Get products by provider |

*Recommendations use auth token if available for personalization, but work without auth using trending/popular fallback.

#### `GET /products` Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | string | Full-text search query |
| `category` | string | Category slug: `tailoring`, `shoemaking`, `beauty`, `leatherwork`, `crafts`, `canvas` |
| `subcategory` | string | Subcategory slug |
| `serviceCategoryId` | number | Filter by service category ID |
| `productCategoryId` | number | Filter by product category ID |
| `priceMin` | number | Minimum price (NGN) |
| `priceMax` | number | Maximum price (NGN) |
| `materials` | string | Comma-separated material keywords |
| `styleTags` | string | Comma-separated style tags |
| `maxDeliveryDays` | number | Maximum delivery days |
| `state` | string | Provider location state |
| `featured` | boolean | Featured products only |
| `isBestSeller` | boolean | Best sellers only |
| `isTrending` | boolean | Trending products only |
| `isNewArrival` | boolean | New arrivals only |
| `sort` | string | `newest`, `price_asc`, `price_desc`, `rating` |
| `page` | number | Page number (default: 1) |
| `pageSize` | number | Items per page (default: 20) |

#### `Product` Schema
```json
{
  "id": "number",
  "name": "string",
  "description": "string (rich text)",
  "priceRange": { "min": 25000, "max": 35000 },
  "currency": "NGN",
  "estimatedDeliveryDays": 7,
  "materials": "string",
  "tags": ["Afrocentric", "Modern"],
  "images": ["url1", "url2"],
  "category": "tailoring | shoemaking | beauty | leatherwork | crafts | canvas",
  "providerId": "number",
  "featured": "boolean (optional)",
  "isBestSeller": "boolean (optional)",
  "isTrending": "boolean (optional)",
  "isNewArrival": "boolean (optional)",
  "discountPercent": "number | null",
  "originalPrice": "number | null"
}
```

#### Response includes `filterMeta` (optional):
```json
{
  "data": [...],
  "pagination": {...},
  "filterMeta": {
    "priceMin": 12000,
    "priceMax": 95000,
    "availableMaterials": ["Cotton", "Leather", "Silk"],
    "availableStyleTags": ["Modern", "Traditional"],
    "availableStates": ["Lagos", "Abia"],
    "maxDeliveryDays": 14
  }
}
```

---

### 2.4 Product Variants

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/products/{productId}/variants` | No | Get customization variants for a product |

#### `ProductVariant` Schema
```json
{
  "id": "string",
  "productId": "number",
  "name": "string (e.g. Blue & Gold)",
  "type": "color | material | design | sole | heel",
  "value": "string (hex color or keyword)",
  "priceModifier": "number (additional cost in NGN, 0 for none)",
  "imageUrl": "string | null (preview image)"
}
```

---

### 2.5 Service Providers

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/service-providers/public-info` | No | List/filter providers |
| GET | `/service-providers/{id}/public-info` | No | Get single provider |
| GET | `/service-providers/recommendations` | No* | Personalized provider suggestions |

#### `GET /service-providers/public-info` Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `category` | string | Category slug |
| `state` | string | Location state |
| `styleTags` | string | Comma-separated style tags |
| `featured` | boolean | Featured only |
| `minRating` | number | Minimum rating |
| `sort` | string | `rating`, `newest`, `featured` |
| `page` | number | Page number |
| `pageSize` | number | Items per page |

#### `ServiceProvider` Schema
```json
{
  "id": "number",
  "brandName": "string",
  "firstName": "string",
  "lastName": "string",
  "about": "string (rich text bio)",
  "city": "string",
  "state": "string",
  "phone": "string",
  "email": "string",
  "rating": "number (1-5, decimal)",
  "reviewCount": "number",
  "verified": "boolean",
  "featured": "boolean",
  "estimatedDeliveryDays": "number",
  "heroImage": "string (URL)",
  "customOrdersEnabled": "boolean",
  "category": "string (category slug)",
  "styleTags": ["string"],
  "serviceCategories": ["string (category slugs)"]
}
```

---

### 2.6 Reviews

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/service-providers/{id}/reviews` | No | List reviews for a provider (paginated) |
| POST | `/service-providers/{id}/reviews` | Yes | Submit a review |

#### `Review` Schema
```json
{
  "id": "number",
  "providerId": "number",
  "customerId": "number",
  "orderId": "string | null",
  "rating": "number (1-5)",
  "comment": "string",
  "createdAt": "ISO 8601 string"
}
```

**Business Rules:**
- One review per customer per provider (or per order)
- Rating must be 1-5 integer
- Comment max length: 1000 characters

---

### 2.7 Orders

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/orders` | Yes | List customer's orders (filterable) |
| GET | `/orders/{id}` | Yes | Get order details with tracking |
| POST | `/orders` | Yes | Create new order |
| PATCH | `/orders/{id}` | Yes | Update order (status, payment info) |

#### `GET /orders` Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status |
| `isCustomOrder` | boolean | Filter custom orders |
| `page` | number | Page number |
| `pageSize` | number | Items per page |

#### `CreateOrderRequest`
```json
{
  "items": [
    {
      "productId": "number",
      "customizationId": "number | null",
      "quantity": "number",
      "finalPrice": "number"
    }
  ],
  "shippingAddress": {
    "firstName": "string",
    "lastName": "string",
    "phone": "string",
    "addressLine1": "string",
    "addressLine2": "string | null",
    "city": "string",
    "state": "string",
    "country": "string (ISO 3166-1 alpha-2)",
    "postalCode": "string | null"
  },
  "paymentMethod": "paystack | flutterwave | bank_transfer | pay_on_delivery",
  "currency": "NGN"
}
```

#### `Order` Schema
```json
{
  "id": "string (e.g. ORD-001)",
  "customerId": "number",
  "productId": "number",
  "productName": "string",
  "productImage": "string (URL)",
  "providerId": "number",
  "providerName": "string",
  "customizationId": "number | null",
  "isCustomOrder": "boolean",
  "status": "pending | awaiting_payment | in_progress | completed | cancelled",
  "price": "number",
  "currency": "string",
  "shippingAddress": "ShippingAddress",
  "paymentMethod": "paystack | flutterwave | bank_transfer | pay_on_delivery",
  "paymentReference": "string | null",
  "paymentStatus": "unpaid | paid | refunded",
  "createdAt": "ISO 8601",
  "updatedAt": "ISO 8601"
}
```

**Business Rules:**
- Order creation should validate product availability
- Order status transitions: `pending` → `awaiting_payment` → `in_progress` → `completed`
- Cancellation allowed only in `pending` or `awaiting_payment` status
- `customerId` auto-populated from auth token

---

### 2.8 Customization Orders

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/customization-orders` | Yes | Submit product customization |
| GET | `/customization-orders/{id}` | Yes | Get customization details |

#### `CreateCustomizationRequest`
```json
{
  "productId": "number",
  "selectedVariants": { "color": "variant_id", "material": "variant_id" },
  "selectedSize": "string (S/M/L/XL or numeric)",
  "selectedBodyType": "string | null (tailoring: slim/average/athletic/plus)",
  "selectedFootType": "string | null (shoemaking: flat/normal/high-arch)",
  "measurements": { "chest": "42", "waist": "34", "length": "30" },
  "notes": "string | null",
  "rushOrder": "boolean"
}
```

#### `CustomizationOrder` Schema
```json
{
  "id": "number",
  "productId": "number",
  "customerId": "number",
  "selectedVariants": {},
  "selectedSize": "string",
  "selectedBodyType": "string | null",
  "selectedFootType": "string | null",
  "measurements": {},
  "notes": "string | null",
  "basePrice": "number",
  "variantModifierTotal": "number",
  "customizationFee": "number",
  "finalPrice": "number",
  "rushOrder": "boolean",
  "rushOrderCost": "number",
  "estimatedDeliveryDays": "number",
  "status": "draft | submitted | confirmed | in_progress | completed | cancelled",
  "createdAt": "ISO 8601",
  "updatedAt": "ISO 8601"
}
```

**Business Rules:**
- `basePrice` = product's base price
- `variantModifierTotal` = sum of selected variant `priceModifier` values
- `customizationFee` = platform customization surcharge (configurable)
- `rushOrderCost` = additional fee if `rushOrder` is true (e.g., 20% of base)
- `finalPrice` = `basePrice + variantModifierTotal + customizationFee + rushOrderCost`
- `estimatedDeliveryDays` = product base delivery days (halved if rush order)

---

### 2.9 Custom Order Requests (Bespoke)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/orders/custom-requests` | Yes | Submit a bespoke order request |

#### Request Body
```json
{
  "providerId": "number (required)",
  "productId": "number | null (reference product)",
  "description": "string (required, detailed description)",
  "material": "string | null",
  "color": "string | null",
  "fittingStyle": "string | null",
  "measurements": { "field": "value" },
  "additionalNotes": "string | null",
  "referenceImageUrl": "string | null (uploaded via /media/upload)"
}
```

**Response (201):**
```json
{
  "id": "number",
  "status": "pending_review"
}
```

**Business Rules:**
- Triggers notification to the provider
- Provider reviews and sends a quote via messaging
- Quote contains pricing breakdown and acceptance link

---

### 2.10 Payments

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/payments/initialize` | Yes | Initialize payment with gateway |
| POST | `/payments/verify` | Yes | Verify payment status |
| POST | `/payments/webhook/paystack` | No* | Paystack webhook callback |
| POST | `/payments/webhook/flutterwave` | No* | Flutterwave webhook callback |

*Webhooks are verified using gateway signatures, not JWT auth.

#### `POST /payments/initialize`
**Request:**
```json
{
  "orderId": "string",
  "amount": "number (in kobo for NGN)",
  "currency": "NGN",
  "email": "string (customer email)",
  "callbackUrl": "string (frontend URL to redirect after payment)",
  "gateway": "paystack | flutterwave",
  "metadata": { "optional": "data" }
}
```

**Response (200):**
```json
{
  "paymentUrl": "https://paystack.com/pay/...",
  "reference": "unique_payment_reference",
  "accessCode": "paystack_access_code (Paystack only)",
  "txRef": "flutterwave_tx_ref (Flutterwave only)"
}
```

#### `POST /payments/verify`
**Request:**
```json
{
  "reference": "payment_reference",
  "gateway": "paystack | flutterwave"
}
```

**Response (200):**
```json
{
  "reference": "string",
  "status": "success | failed | pending",
  "amount": "number",
  "currency": "string",
  "paidAt": "ISO 8601 | null",
  "orderId": "string"
}
```

**Business Rules:**
- On successful webhook verification, update order `paymentStatus` to `paid` and `status` to `in_progress`
- Webhook signatures must be validated (Paystack: `x-paystack-signature`, Flutterwave: `verif-hash`)
- Store all payment transaction logs for auditing

---

### 2.11 Cart

Server-side cart for authenticated users. Guest users use localStorage (frontend handles this).

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/customers/me/cart` | Yes | List cart items |
| POST | `/customers/me/cart` | Yes | Add item to cart |
| PATCH | `/customers/me/cart/{id}` | Yes | Update cart item |
| DELETE | `/customers/me/cart/{id}` | Yes | Remove cart item |
| DELETE | `/customers/me/cart` | Yes | Clear entire cart |

#### `CartItem` Schema
```json
{
  "id": "string (UUID)",
  "productId": "number",
  "productName": "string",
  "providerId": "number",
  "providerName": "string",
  "basePrice": "number",
  "finalPrice": "number",
  "category": "string",
  "selectedSize": "string",
  "selectedBodyType": "string | null",
  "selectedVariants": {},
  "measurements": {},
  "notes": "string | null",
  "quantity": "number"
}
```

---

### 2.12 Wishlist

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/customers/me/wishlist` | Yes | List wishlist items |
| POST | `/customers/me/wishlist` | Yes | Add product to wishlist |
| DELETE | `/customers/me/wishlist/{productId}` | Yes | Remove from wishlist |

#### `WishlistItem` Schema
```json
{
  "id": "number",
  "customerId": "number",
  "productId": "number",
  "productName": "string",
  "providerId": "number",
  "providerName": "string",
  "priceMin": "number",
  "priceMax": "number",
  "currency": "string",
  "category": "string",
  "imageUrl": "string",
  "styleTags": ["string"],
  "addedAt": "ISO 8601"
}
```

---

### 2.13 Messaging

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/conversations` | Yes | List customer's conversations |
| POST | `/conversations` | Yes | Start new conversation with provider |
| GET | `/conversations/{id}/messages` | Yes | Get messages in conversation |
| POST | `/conversations/{id}/messages` | Yes | Send a message |
| PATCH | `/conversations/{id}/read` | Yes | Mark conversation as read |

#### `Conversation` Schema
```json
{
  "id": "number",
  "customerId": "number",
  "providerId": "number",
  "providerName": "string",
  "lastMessage": "string",
  "lastMessageTime": "ISO 8601",
  "unreadCount": "number"
}
```

#### `Message` Schema
```json
{
  "id": "number",
  "conversationId": "number",
  "senderId": "number",
  "senderType": "customer | provider",
  "content": "string",
  "sentAt": "ISO 8601",
  "readAt": "ISO 8601 | null"
}
```

#### `POST /conversations`
**Request:**
```json
{
  "providerId": "number",
  "initialMessage": "string"
}
```

**Business Rules:**
- If a conversation already exists between the customer and provider, return existing conversation
- Support for rich content (images, files) in future iterations via `contentType` field

---

### 2.14 Notifications

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/notifications` | Yes | List user's notifications (paginated) |
| PATCH | `/notifications/{id}/read` | Yes | Mark single notification as read |
| PATCH | `/notifications/read-all` | Yes | Mark all as read |

#### `Notification` Schema
```json
{
  "id": "number",
  "userId": "number",
  "type": "order_update | message | promotion | system",
  "title": "string",
  "body": "string",
  "read": "boolean",
  "link": "string | null (frontend route to navigate to)",
  "createdAt": "ISO 8601"
}
```

**Business Rules:**
- Notifications are created server-side when events occur (order status change, new message, etc.)
- Support granular notification preferences (email, SMS, push) per user
- Consider WebSocket/SSE for real-time push in future iteration

---

### 2.15 Search

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/search` | No | Unified search across products, providers, categories |

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | string | Search query (required) |
| `type` | string | `all`, `products`, `providers`, `categories` (default: `all`) |

#### Response
```json
{
  "products": [Product],
  "providers": [ServiceProvider],
  "categories": [{ "id": "string", "name": "string" }]
}
```

**Business Rules:**
- Full-text search across product names, descriptions, tags, materials
- Search across provider brand names, categories, style tags
- Results segmented by type for the frontend's predictive search UI
- Minimum query length: 2 characters

---

### 2.16 Support Tickets

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/support/tickets` | No* | Create support ticket |
| GET | `/support/tickets` | Yes | List user's tickets |

*Unauthenticated users can submit contact/report tickets with email.

#### `SupportTicket` Schema
```json
{
  "id": "number",
  "customerId": "number | null",
  "type": "contact | order_issue | report | return_request",
  "orderId": "string | null",
  "subject": "string",
  "description": "string",
  "email": "string",
  "status": "open | in_review | resolved | closed",
  "createdAt": "ISO 8601"
}
```

---

### 2.17 Media Upload

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/media/upload` | Yes | Upload file (image, document) |
| GET | `/media/{id}` | No | Retrieve media file |

#### `POST /media/upload`
**Request:** `multipart/form-data` with field `file`  
**Response (201):**
```json
{
  "id": "string",
  "url": "string (public URL)",
  "mimeType": "string",
  "size": "number (bytes)"
}
```

**Business Rules:**
- Accepted types: JPEG, PNG, WebP, PDF
- Max file size: 10MB (images), 25MB (documents)
- Used for: custom order reference images, canvas uploads, profile avatars

---

### 2.18 Admin

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/admin/dashboard/stats` | Admin | Dashboard aggregate stats |
| GET | `/admin/products` | Admin | List all products |
| POST | `/admin/products` | Admin | Create product |
| PATCH | `/admin/products/{id}` | Admin | Update product |
| DELETE | `/admin/products/{id}` | Admin | Delete product |
| GET | `/admin/service-providers` | Admin | List all providers |
| POST | `/admin/service-providers` | Admin | Create provider |
| PATCH | `/admin/service-providers/{id}` | Admin | Update provider |
| PATCH | `/admin/service-providers/{id}/toggle-status` | Admin | Toggle verified/featured |
| GET | `/admin/orders` | Admin | List all orders |
| PATCH | `/admin/orders/{id}` | Admin | Update order status |
| GET | `/admin/categories` | Admin | List categories |
| POST | `/admin/categories` | Admin | Create category |
| PATCH | `/admin/categories/{id}` | Admin | Update category |
| DELETE | `/admin/categories/{id}` | Admin | Delete category |
| GET | `/admin/media` | Admin | List uploaded media |

#### `AdminDashboardStats` Schema
```json
{
  "totalProviders": "number",
  "totalProducts": "number",
  "totalOrders": "number",
  "totalRevenue": "number",
  "pendingOrders": "number",
  "activeProviders": "number",
  "newProvidersThisMonth": "number",
  "newOrdersThisMonth": "number"
}
```

---

## 3. Database Schema

### Entity Relationship Overview

```
users (auth)
  ├── customer_profiles (1:1)
  │     ├── user_preferences (1:1)
  │     ├── addresses (1:N)
  │     ├── payment_methods (1:N)
  │     ├── cart_items (1:N)
  │     ├── wishlist_items (1:N)
  │     ├── orders (1:N)
  │     ├── notifications (1:N)
  │     └── support_tickets (1:N)
  └── user_roles (1:N)

service_providers
  ├── products (1:N)
  │     └── product_variants (1:N)
  ├── reviews (1:N)
  └── conversations (1:N)
        └── messages (1:N)

orders
  ├── order_items (1:N)
  ├── customization_orders (1:1, optional)
  └── payment_transactions (1:N)

service_categories
  └── sub_categories (1:N)

media (standalone, referenced by URL)
```

### Key Tables

#### `users`
| Column | Type | Constraints |
|--------|------|-------------|
| id | BIGINT | PK, AUTO_INCREMENT |
| name | VARCHAR(100) | NOT NULL |
| email | VARCHAR(255) | UNIQUE, NOT NULL |
| password | VARCHAR(255) | NOT NULL (hashed) |
| phone | VARCHAR(20) | NULLABLE |
| avatar_url | VARCHAR(500) | NULLABLE |
| email_verified_at | TIMESTAMP | NULLABLE |
| created_at | TIMESTAMP | NOT NULL |
| updated_at | TIMESTAMP | NOT NULL |

#### `user_roles`
| Column | Type | Constraints |
|--------|------|-------------|
| id | BIGINT | PK |
| user_id | BIGINT | FK → users.id, ON DELETE CASCADE |
| role | ENUM('admin','customer','provider') | NOT NULL |
| UNIQUE | (user_id, role) | |

#### `user_preferences`
| Column | Type | Constraints |
|--------|------|-------------|
| id | BIGINT | PK |
| user_id | BIGINT | FK → users.id, UNIQUE |
| categories | JSON | DEFAULT '[]' |
| style_tags | JSON | DEFAULT '[]' |
| budget | DECIMAL(12,2) | DEFAULT 500000 |
| updated_at | TIMESTAMP | |

#### `service_providers`
| Column | Type | Constraints |
|--------|------|-------------|
| id | BIGINT | PK |
| user_id | BIGINT | FK → users.id, NULLABLE |
| brand_name | VARCHAR(100) | NOT NULL |
| first_name | VARCHAR(50) | NOT NULL |
| last_name | VARCHAR(50) | NOT NULL |
| about | TEXT | |
| city | VARCHAR(100) | |
| state | VARCHAR(100) | |
| phone | VARCHAR(20) | |
| email | VARCHAR(255) | |
| rating | DECIMAL(2,1) | DEFAULT 0 |
| review_count | INT | DEFAULT 0 |
| verified | BOOLEAN | DEFAULT FALSE |
| featured | BOOLEAN | DEFAULT FALSE |
| estimated_delivery_days | INT | |
| hero_image | VARCHAR(500) | |
| custom_orders_enabled | BOOLEAN | DEFAULT FALSE |
| category | VARCHAR(50) | |
| style_tags | JSON | DEFAULT '[]' |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

#### `products`
| Column | Type | Constraints |
|--------|------|-------------|
| id | BIGINT | PK |
| provider_id | BIGINT | FK → service_providers.id |
| name | VARCHAR(200) | NOT NULL |
| description | TEXT | |
| price_min | DECIMAL(12,2) | NOT NULL |
| price_max | DECIMAL(12,2) | NOT NULL |
| currency | VARCHAR(3) | DEFAULT 'NGN' |
| estimated_delivery_days | INT | |
| materials | VARCHAR(200) | |
| tags | JSON | DEFAULT '[]' |
| images | JSON | DEFAULT '[]' |
| category | VARCHAR(50) | NOT NULL |
| featured | BOOLEAN | DEFAULT FALSE |
| is_best_seller | BOOLEAN | DEFAULT FALSE |
| is_trending | BOOLEAN | DEFAULT FALSE |
| is_new_arrival | BOOLEAN | DEFAULT FALSE |
| discount_percent | DECIMAL(5,2) | NULLABLE |
| original_price | DECIMAL(12,2) | NULLABLE |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

#### `product_variants`
| Column | Type | Constraints |
|--------|------|-------------|
| id | VARCHAR(36) | PK (UUID) |
| product_id | BIGINT | FK → products.id |
| name | VARCHAR(100) | NOT NULL |
| type | ENUM('color','material','design','sole','heel') | NOT NULL |
| value | VARCHAR(100) | NOT NULL |
| price_modifier | DECIMAL(12,2) | DEFAULT 0 |
| image_url | VARCHAR(500) | NULLABLE |

#### `orders`
| Column | Type | Constraints |
|--------|------|-------------|
| id | VARCHAR(20) | PK (e.g. ORD-001) |
| customer_id | BIGINT | FK → users.id |
| product_id | BIGINT | FK → products.id |
| product_name | VARCHAR(200) | |
| product_image | VARCHAR(500) | |
| provider_id | BIGINT | FK → service_providers.id |
| provider_name | VARCHAR(100) | |
| customization_id | BIGINT | FK → customization_orders.id, NULLABLE |
| is_custom_order | BOOLEAN | DEFAULT FALSE |
| status | ENUM('pending','awaiting_payment','in_progress','completed','cancelled') | |
| price | DECIMAL(12,2) | NOT NULL |
| currency | VARCHAR(3) | DEFAULT 'NGN' |
| shipping_address | JSON | NOT NULL |
| payment_method | ENUM('paystack','flutterwave','bank_transfer','pay_on_delivery') | |
| payment_reference | VARCHAR(100) | NULLABLE |
| payment_status | ENUM('unpaid','paid','refunded') | DEFAULT 'unpaid' |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

#### `customization_orders`
| Column | Type | Constraints |
|--------|------|-------------|
| id | BIGINT | PK |
| product_id | BIGINT | FK → products.id |
| customer_id | BIGINT | FK → users.id |
| selected_variants | JSON | |
| selected_size | VARCHAR(20) | |
| selected_body_type | VARCHAR(30) | NULLABLE |
| selected_foot_type | VARCHAR(30) | NULLABLE |
| measurements | JSON | |
| notes | TEXT | NULLABLE |
| base_price | DECIMAL(12,2) | |
| variant_modifier_total | DECIMAL(12,2) | |
| customization_fee | DECIMAL(12,2) | |
| final_price | DECIMAL(12,2) | |
| rush_order | BOOLEAN | DEFAULT FALSE |
| rush_order_cost | DECIMAL(12,2) | DEFAULT 0 |
| estimated_delivery_days | INT | |
| status | ENUM('draft','submitted','confirmed','in_progress','completed','cancelled') | |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

#### `conversations`
| Column | Type | Constraints |
|--------|------|-------------|
| id | BIGINT | PK |
| customer_id | BIGINT | FK → users.id |
| provider_id | BIGINT | FK → service_providers.id |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |
| UNIQUE | (customer_id, provider_id) | |

#### `messages`
| Column | Type | Constraints |
|--------|------|-------------|
| id | BIGINT | PK |
| conversation_id | BIGINT | FK → conversations.id |
| sender_id | BIGINT | NOT NULL |
| sender_type | ENUM('customer','provider') | NOT NULL |
| content | TEXT | NOT NULL |
| sent_at | TIMESTAMP | NOT NULL |
| read_at | TIMESTAMP | NULLABLE |

#### `notifications`
| Column | Type | Constraints |
|--------|------|-------------|
| id | BIGINT | PK |
| user_id | BIGINT | FK → users.id |
| type | ENUM('order_update','message','promotion','system') | |
| title | VARCHAR(200) | |
| body | TEXT | |
| read | BOOLEAN | DEFAULT FALSE |
| link | VARCHAR(500) | NULLABLE |
| created_at | TIMESTAMP | |

#### `reviews`
| Column | Type | Constraints |
|--------|------|-------------|
| id | BIGINT | PK |
| provider_id | BIGINT | FK → service_providers.id |
| customer_id | BIGINT | FK → users.id |
| order_id | VARCHAR(20) | FK → orders.id, NULLABLE |
| rating | TINYINT | NOT NULL, CHECK (1-5) |
| comment | TEXT | |
| created_at | TIMESTAMP | |

#### `cart_items`
| Column | Type | Constraints |
|--------|------|-------------|
| id | VARCHAR(36) | PK (UUID) |
| customer_id | BIGINT | FK → users.id |
| product_id | BIGINT | FK → products.id |
| product_name | VARCHAR(200) | |
| provider_id | BIGINT | |
| provider_name | VARCHAR(100) | |
| base_price | DECIMAL(12,2) | |
| final_price | DECIMAL(12,2) | |
| category | VARCHAR(50) | |
| selected_size | VARCHAR(20) | |
| selected_body_type | VARCHAR(30) | NULLABLE |
| selected_variants | JSON | |
| measurements | JSON | |
| notes | TEXT | NULLABLE |
| quantity | INT | DEFAULT 1 |

#### `wishlist_items`
| Column | Type | Constraints |
|--------|------|-------------|
| id | BIGINT | PK |
| customer_id | BIGINT | FK → users.id |
| product_id | BIGINT | FK → products.id |
| added_at | TIMESTAMP | |
| UNIQUE | (customer_id, product_id) | |

#### `support_tickets`
| Column | Type | Constraints |
|--------|------|-------------|
| id | BIGINT | PK |
| customer_id | BIGINT | FK → users.id, NULLABLE |
| type | ENUM('contact','order_issue','report','return_request') | |
| order_id | VARCHAR(20) | NULLABLE |
| subject | VARCHAR(200) | |
| description | TEXT | |
| email | VARCHAR(255) | |
| status | ENUM('open','in_review','resolved','closed') | DEFAULT 'open' |
| created_at | TIMESTAMP | |

#### `addresses`
| Column | Type | Constraints |
|--------|------|-------------|
| id | BIGINT | PK |
| user_id | BIGINT | FK → users.id |
| label | VARCHAR(50) | |
| street | VARCHAR(200) | |
| city | VARCHAR(100) | |
| state | VARCHAR(100) | |
| country | VARCHAR(100) | |
| postal_code | VARCHAR(20) | NULLABLE |
| is_default | BOOLEAN | DEFAULT FALSE |

#### `payment_methods`
| Column | Type | Constraints |
|--------|------|-------------|
| id | BIGINT | PK |
| user_id | BIGINT | FK → users.id |
| type | VARCHAR(20) | e.g. VISA, Mastercard |
| last4 | VARCHAR(4) | |
| expiry | VARCHAR(7) | MM/YY |
| is_default | BOOLEAN | DEFAULT FALSE |
| token | VARCHAR(255) | encrypted gateway token |

#### `payment_transactions`
| Column | Type | Constraints |
|--------|------|-------------|
| id | BIGINT | PK |
| order_id | VARCHAR(20) | FK → orders.id |
| gateway | ENUM('paystack','flutterwave') | |
| reference | VARCHAR(100) | UNIQUE |
| amount | DECIMAL(12,2) | |
| currency | VARCHAR(3) | |
| status | ENUM('pending','success','failed') | |
| gateway_response | JSON | NULLABLE |
| paid_at | TIMESTAMP | NULLABLE |
| created_at | TIMESTAMP | |

#### `media`
| Column | Type | Constraints |
|--------|------|-------------|
| id | VARCHAR(36) | PK (UUID) |
| url | VARCHAR(500) | NOT NULL |
| mime_type | VARCHAR(50) | |
| size | INT | bytes |
| uploaded_by | BIGINT | FK → users.id |
| created_at | TIMESTAMP | |

#### `service_categories`
| Column | Type | Constraints |
|--------|------|-------------|
| id | BIGINT | PK |
| name | VARCHAR(100) | NOT NULL |
| slug | VARCHAR(100) | UNIQUE |
| description | TEXT | NULLABLE |
| image_url | VARCHAR(500) | NULLABLE |
| parent_id | BIGINT | FK → service_categories.id, NULLABLE |

---

## 4. Authentication & Authorization Design

### Roles

| Role | Access |
|------|--------|
| `customer` | Own profile, orders, cart, wishlist, messages, reviews |
| `provider` | Own products, incoming orders, conversations, custom order requests |
| `admin` | Full access to all resources via `/admin/*` endpoints |

### Authorization Rules

1. **Customers** can only access their own data (enforced by `WHERE customer_id = auth.user_id`)
2. **Providers** can only manage their own products and view orders for their products
3. **Admins** have unrestricted access
4. Roles stored in `user_roles` table (NOT in users table) to prevent privilege escalation
5. Use middleware: `auth:sanctum` + custom `role:admin` middleware

### Laravel Middleware Stack
```php
// routes/api.php
Route::prefix('auth')->group(function () {
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/refresh-token', [AuthController::class, 'refresh']);
    
    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/profile', [AuthController::class, 'profile']);
        Route::post('/logout', [AuthController::class, 'logout']);
    });
});

Route::middleware('auth:sanctum')->group(function () {
    // Customer routes...
});

Route::middleware(['auth:sanctum', 'role:admin'])->prefix('admin')->group(function () {
    // Admin routes...
});
```

---

## 5. Error Handling

### Standard Error Response
```json
{
  "message": "Human-readable error description",
  "code": "MACHINE_READABLE_CODE",
  "errors": {
    "field_name": ["Validation error message"]
  }
}
```

### HTTP Status Codes

| Code | Usage |
|------|-------|
| 200 | Success |
| 201 | Created |
| 204 | No Content (successful delete) |
| 400 | Bad Request / Validation error |
| 401 | Unauthorized (missing/invalid token) |
| 403 | Forbidden (insufficient role) |
| 404 | Resource not found |
| 409 | Conflict (duplicate entry) |
| 422 | Unprocessable Entity (validation) |
| 429 | Rate limited |
| 500 | Internal server error |

### Error Codes (used by frontend)
- `AUTH_INVALID_CREDENTIALS`
- `AUTH_TOKEN_EXPIRED`
- `AUTH_REFRESH_FAILED`
- `VALIDATION_ERROR`
- `RESOURCE_NOT_FOUND`
- `PAYMENT_FAILED`
- `ORDER_INVALID_STATUS_TRANSITION`
- `RATE_LIMIT_EXCEEDED`

---

## 6. Pagination Convention

All list endpoints support:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `page` | 1 | Current page |
| `pageSize` | 20 | Items per page (max 100) |

Response:
```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalPages": 5,
    "totalItems": 100
  }
}
```

---

## 7. Security Best Practices

1. **Password hashing**: bcrypt with cost factor ≥ 12
2. **Input validation**: Validate all inputs server-side using Laravel Form Requests
3. **SQL injection**: Use Eloquent ORM / prepared statements exclusively
4. **XSS**: Sanitize all user-generated content before storage
5. **CORS**: Configure allowed origins to frontend domain(s) only
6. **Rate limiting**: Apply per-IP and per-user rate limits (e.g., 60 req/min for auth, 200 req/min for general)
7. **File upload**: Validate MIME types server-side, scan for malware, store outside web root
8. **Secrets**: Store Paystack/Flutterwave API keys in environment variables, never in code
9. **HTTPS**: Enforce TLS on all endpoints
10. **Webhook verification**: Validate signatures from payment gateways
11. **Token rotation**: Issue new refresh token on each refresh (rotate)
12. **Audit logging**: Log all admin actions and payment events

---

## 8. Scalability & Infrastructure

### Recommended Architecture

```
[CDN / Cloudflare]
       ↓
[Load Balancer]
       ↓
[Laravel App (Stateless)] ←→ [Redis (Cache + Sessions + Queues)]
       ↓
[MySQL / PostgreSQL]
       ↓
[Object Storage (S3/Spaces)] ← media uploads
```

### Key Considerations

1. **Stateless API**: No server-side sessions; JWT tokens enable horizontal scaling
2. **Queue system**: Use Laravel Queues (Redis driver) for:
   - Email notifications
   - Payment webhook processing
   - Image processing/resizing
   - Search index updates
3. **Caching**: Cache product listings, provider profiles, categories (invalidate on update)
4. **Database indexing**: Index on:
   - `products.category`, `products.provider_id`
   - `orders.customer_id`, `orders.status`
   - `service_providers.category`, `service_providers.featured`
   - `conversations.customer_id`, `conversations.provider_id`
5. **Full-text search**: Consider Algolia, Meilisearch, or MySQL FULLTEXT for `/search` endpoint
6. **CDN**: Serve media/images through CDN for performance

---

## 9. Logging & Monitoring

### Application Logging

| Event | Level | Data |
|-------|-------|------|
| Auth login/register | INFO | user_id, IP, user_agent |
| Auth failure | WARNING | email, IP, reason |
| Order created | INFO | order_id, customer_id, amount |
| Payment initialized | INFO | order_id, gateway, amount |
| Payment verified | INFO | reference, status, amount |
| Payment webhook received | INFO | gateway, reference, signature_valid |
| Admin action | INFO | admin_id, action, target_resource |
| API error (5xx) | ERROR | endpoint, request_body, stack_trace |
| Rate limit hit | WARNING | IP, user_id, endpoint |

### Monitoring Recommendations

1. **Uptime monitoring**: Health check endpoint `GET /health` returning `{ "status": "ok" }`
2. **Error tracking**: Sentry or Bugsnag for real-time error reporting
3. **Performance**: Track response times per endpoint (P50, P95, P99)
4. **Business metrics**: Daily order count, revenue, new registrations
5. **Alerting**: Alert on payment failures, error rate spikes, high latency

### Health Check Endpoint

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health` | No | System health status |

**Response:**
```json
{
  "status": "ok",
  "timestamp": "ISO 8601",
  "database": "connected",
  "cache": "connected"
}
```

---

## Appendix: Complete Endpoint Summary

| # | Method | Endpoint | Auth | Module |
|---|--------|----------|------|--------|
| 1 | POST | `/auth/register` | No | Auth |
| 2 | POST | `/auth/login` | No | Auth |
| 3 | POST | `/auth/logout` | Yes | Auth |
| 4 | POST | `/auth/refresh-token` | No | Auth |
| 5 | GET | `/auth/profile` | Yes | Auth |
| 6 | PATCH | `/auth/profile` | Yes | Profile |
| 7 | POST | `/auth/forgot-password` | No | Auth |
| 8 | POST | `/auth/reset-password` | No | Auth |
| 9 | GET | `/customers/me/preferences` | Yes | Preferences |
| 10 | POST | `/customers/me/preferences` | Yes | Preferences |
| 11 | DELETE | `/customers/me/preferences` | Yes | Preferences |
| 12 | GET | `/customers/me/addresses` | Yes | Addresses |
| 13 | POST | `/customers/me/addresses` | Yes | Addresses |
| 14 | PATCH | `/customers/me/addresses/{id}` | Yes | Addresses |
| 15 | DELETE | `/customers/me/addresses/{id}` | Yes | Addresses |
| 16 | GET | `/customers/me/payment-methods` | Yes | Payments |
| 17 | POST | `/customers/me/payment-methods` | Yes | Payments |
| 18 | DELETE | `/customers/me/payment-methods/{id}` | Yes | Payments |
| 19 | GET | `/products` | No | Products |
| 20 | GET | `/products/{id}` | No | Products |
| 21 | GET | `/products/recommendations` | No* | Products |
| 22 | GET | `/products/{id}/variants` | No | Variants |
| 23 | GET | `/service-providers/public-info` | No | Providers |
| 24 | GET | `/service-providers/{id}/public-info` | No | Providers |
| 25 | GET | `/service-providers/recommendations` | No* | Providers |
| 26 | GET | `/service-providers/{id}/products` | No | Providers |
| 27 | GET | `/service-providers/{id}/reviews` | No | Reviews |
| 28 | POST | `/service-providers/{id}/reviews` | Yes | Reviews |
| 29 | GET | `/orders` | Yes | Orders |
| 30 | GET | `/orders/{id}` | Yes | Orders |
| 31 | POST | `/orders` | Yes | Orders |
| 32 | PATCH | `/orders/{id}` | Yes | Orders |
| 33 | POST | `/customization-orders` | Yes | Customization |
| 34 | GET | `/customization-orders/{id}` | Yes | Customization |
| 35 | POST | `/orders/custom-requests` | Yes | Bespoke |
| 36 | POST | `/payments/initialize` | Yes | Payments |
| 37 | POST | `/payments/verify` | Yes | Payments |
| 38 | POST | `/payments/webhook/paystack` | No* | Payments |
| 39 | POST | `/payments/webhook/flutterwave` | No* | Payments |
| 40 | GET | `/customers/me/cart` | Yes | Cart |
| 41 | POST | `/customers/me/cart` | Yes | Cart |
| 42 | PATCH | `/customers/me/cart/{id}` | Yes | Cart |
| 43 | DELETE | `/customers/me/cart/{id}` | Yes | Cart |
| 44 | DELETE | `/customers/me/cart` | Yes | Cart |
| 45 | GET | `/customers/me/wishlist` | Yes | Wishlist |
| 46 | POST | `/customers/me/wishlist` | Yes | Wishlist |
| 47 | DELETE | `/customers/me/wishlist/{productId}` | Yes | Wishlist |
| 48 | GET | `/conversations` | Yes | Messaging |
| 49 | POST | `/conversations` | Yes | Messaging |
| 50 | GET | `/conversations/{id}/messages` | Yes | Messaging |
| 51 | POST | `/conversations/{id}/messages` | Yes | Messaging |
| 52 | PATCH | `/conversations/{id}/read` | Yes | Messaging |
| 53 | GET | `/notifications` | Yes | Notifications |
| 54 | PATCH | `/notifications/{id}/read` | Yes | Notifications |
| 55 | PATCH | `/notifications/read-all` | Yes | Notifications |
| 56 | GET | `/search` | No | Search |
| 57 | POST | `/support/tickets` | No* | Support |
| 58 | GET | `/support/tickets` | Yes | Support |
| 59 | POST | `/media/upload` | Yes | Media |
| 60 | GET | `/media/{id}` | No | Media |
| 61 | GET | `/admin/dashboard/stats` | Admin | Admin |
| 62 | GET | `/admin/products` | Admin | Admin |
| 63 | POST | `/admin/products` | Admin | Admin |
| 64 | PATCH | `/admin/products/{id}` | Admin | Admin |
| 65 | DELETE | `/admin/products/{id}` | Admin | Admin |
| 66 | GET | `/admin/service-providers` | Admin | Admin |
| 67 | POST | `/admin/service-providers` | Admin | Admin |
| 68 | PATCH | `/admin/service-providers/{id}` | Admin | Admin |
| 69 | PATCH | `/admin/service-providers/{id}/toggle-status` | Admin | Admin |
| 70 | GET | `/admin/orders` | Admin | Admin |
| 71 | PATCH | `/admin/orders/{id}` | Admin | Admin |
| 72 | GET | `/admin/categories` | Admin | Admin |
| 73 | POST | `/admin/categories` | Admin | Admin |
| 74 | PATCH | `/admin/categories/{id}` | Admin | Admin |
| 75 | DELETE | `/admin/categories/{id}` | Admin | Admin |
| 76 | GET | `/admin/media` | Admin | Admin |
| 77 | GET | `/health` | No | System |

**Total: 77 endpoints**

---

*This document serves as the definitive backend contract. All endpoints, schemas, and business rules are derived directly from the MOE React frontend implementation and must be implemented to fully replace mock data with live API responses.*
