# MOE Backend API Implementation Audit & Requirements

## Objective
Audit the current backend implementation against the API contract below and implement any missing endpoints.

---

## Instructions

For each endpoint:

1. Check whether it already exists  
2. If it exists, verify it is functional and matches the expected purpose  
3. If it does not exist, implement it  
4. Ensure request/response structures match frontend expectations  
5. Add authentication, validation, authorization, and database integration where required  

---

## Auth

| Method | Endpoint | Purpose |
|---|---|---|
| POST | /auth/login | Login → returns { token, refreshToken, user } |
| POST | /auth/register | Register → returns { token, refreshToken, user } |
| POST | /auth/logout | Invalidate tokens |
| POST | /auth/refresh-token | Refresh JWT → { token, refreshToken } |
| GET | /auth/profile | Get current user profile |
| PATCH | /auth/profile | Update profile (name, email, phone, avatarUrl) |
| POST | /auth/profile/avatar | Upload avatar (multipart/form-data) → { avatarUrl } |
| POST | /auth/change-password | Change password |

---

## Products

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /products | List/filter products |
| GET | /products/:id | Get single product |
| GET | /products/recommendations | Personalized recommendations |
| GET | /products/:id/variants | Get product variants |

---

## Providers (Artisans)

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /service-providers/public-info | List/filter providers |
| GET | /service-providers/:id/public-info | Get provider |
| GET | /service-providers/:id/products | Products by provider |
| GET | /service-providers/:id/reviews | Reviews |
| POST | /service-providers/:id/reviews | Create review |
| GET | /service-providers/recommendations | Recommended providers |

---

## Artisan Dashboard (Authenticated)

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /artisans/me | Get artisan profile |
| PATCH | /artisans/me | Update artisan profile |
| GET | /artisans/me/products | List my products |
| POST | /artisans/me/products | Create product |
| PATCH | /artisans/me/products/:id | Update product |
| DELETE | /artisans/me/products/:id | Delete product |

---

## Cart (Authenticated)

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /customers/me/cart | List cart items |
| POST | /customers/me/cart | Add item |
| PATCH | /customers/me/cart/:id | Update item |
| DELETE | /customers/me/cart/:id | Remove item |
| DELETE | /customers/me/cart | Clear cart |

---

## Wishlist (Authenticated)

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /customers/me/wishlist | List wishlist |
| POST | /customers/me/wishlist | Add item |
| DELETE | /customers/me/wishlist/:productId | Remove item |

---

## Orders

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /orders | List orders |
| GET | /orders/:id | Order details |
| POST | /orders | Create order |
| PATCH | /orders/:id | Update order |

---

## Customization & Custom Orders

| Method | Endpoint | Purpose |
|---|---|---|
| POST | /customization-orders | Create customization order |
| GET | /customization-orders/:id | Get details |
| POST | /orders/custom-requests | Submit custom request |

---

## Payments

| Method | Endpoint | Purpose |
|---|---|---|
| POST | /payments/initialize | Initialize payment |
| POST | /payments/verify | Verify payment |

---

## Preferences

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /customers/me/preferences | Get preferences |
| POST | /customers/me/preferences | Update preferences |
| DELETE | /customers/me/preferences | Clear preferences |

---

## Messaging

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /conversations | List conversations |
| GET | /conversations/:id/messages | Get messages |
| POST | /conversations/:id/messages | Send message |
| POST | /conversations | Start conversation |
| PATCH | /conversations/:id/read | Mark as read |

---

## Notifications

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /notifications | List notifications |
| PATCH | /notifications/:id/read | Mark read |
| PATCH | /notifications/read-all | Mark all read |

---

## Search

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /search | Search → { products, providers, categories } |

---

## Support

| Method | Endpoint | Purpose |
|---|---|---|
| POST | /support/tickets | Create ticket |
| GET | /support/tickets | List tickets |

---

## Additional Requirements

- Use the existing backend stack (NestJS + Prisma + PostgreSQL)
- Apply authentication to protected routes
- Enforce role-based authorization (especially artisan features)
- Ensure all endpoints persist data in the database (no mock data)
- Maintain consistent JSON response format
- Add validation, pagination, and proper error handling

---

## Expected Output

1. Gap analysis (existing vs missing endpoints)
2. Implementation of missing endpoints
3. Required schema/model updates
4. DTOs, services, controllers, guards, and validation logic
5. Summary of changes made