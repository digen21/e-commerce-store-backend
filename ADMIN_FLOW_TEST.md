# Admin Flow Test Guide

## Prerequisites

| Step | Action | Command/Details |
|------|--------|-----------------|
| 1 | Create Admin User | Insert directly into MongoDB |
| 2 | Start Server | `npm run dev` |
| 3 | Test Tool | Use cURL, Postman, or Thunder Client |

---

## 1. Create Admin User (MongoDB)

```javascript
use ecommerce

db.users.insertOne({
  name: "Admin User",
  email: "admin@example.com",
  password: "$2b$10$YourHashedPasswordHere",
  role: "ADMIN",
  isVerified: true,
  createdAt: new Date(),
  updatedAt: new Date()
})
```

---

## 2. Authentication Flow

| # | Action | Method | Endpoint | Request Body | Expected Response | Status |
|---|--------|--------|----------|--------------|-------------------|--------|
| 1 | Login | POST | `/api/auth/login` | `{"email":"admin@example.com","password":"admin123"}` | `{success: true, status: 200}` | ⬜ |
| 2 | Get Profile | GET | `/api/auth/profile` | - | `{user: {role: "ADMIN"}}` | ⬜ |
| 3 | Logout | POST | `/api/auth/logout` | - | `{success: true}` | ⬜ |

---

## 3. Product Management (Admin Only)

| # | Action | Method | Endpoint | Request Body | Expected Response | Status |
|---|--------|--------|----------|--------------|-------------------|--------|
| 1 | Create Product | POST | `/api/products` | `{"title":"Test Product","price":99.99,"stock":50,"category":"Electronics"}` | `{success: true, data: {...}}` | ⬜ |
| 2 | Get All Products | GET | `/api/products?page=1&limit=10` | - | `{success: true, data: [...]}` | ⬜ |
| 3 | Get Product by ID | GET | `/api/products/:id` | - | `{success: true, data: {...}}` | ⬜ |
| 4 | Update Product | PUT | `/api/products/:id` | `{"title":"Updated Title","price":79.99}` | `{success: true, data: {...}}` | ⬜ |
| 5 | Delete Product | DELETE | `/api/products/:id` | - | `{success: true}` | ⬜ |
| 6 | Get Upload Signature | POST | `/api/products/upload/signature` | `{"folder":"products","public_id":"test_001"}` | `{success: true, data: {...}}` | ⬜ |

---

## 4. User Management (Admin Only)

| # | Action | Method | Endpoint | Request Body | Expected Response | Status |
|---|--------|--------|----------|--------------|-------------------|--------|
| 1 | Get All Users | GET | `/api/users?page=1&limit=10` | - | `{success: true, data: [...]}` | ⬜ |
| 2 | Get User by ID (Admin) | GET | `/api/users/admin/:id` | - | `{success: true, data: {...}}` | ⬜ |

---

## 5. User Details Management

| # | Action | Method | Endpoint | Request Body | Expected Response | Status |
|---|--------|--------|----------|--------------|-------------------|--------|
| 1 | Get My Details | GET | `/api/users/me` | - | `{success: true, data: {...}}` | ⬜ |
| 2 | Update My Details | PUT | `/api/users/me` | `{"addresses":[...]}` | `{success: true}` | ⬜ |
| 3 | Get User by ID | GET | `/api/users/:id` | - | `{success: true, data: {...}}` | ⬜ |

---

## 6. Order Management - Create Order

| # | Action | Method | Endpoint | Request Body | Expected Response | Status |
|---|--------|--------|----------|--------------|-------------------|--------|
| 1 | Create Order | POST | `/api/orders` | `{"items":[{"productId":"...","quantity":2}]}` | `{success: true, data: {...}}` | ⬜ |
| 2 | Get My Orders | GET | `/api/orders?page=1&limit=10` | - | `{success: true, data: [...]}` | ⬜ |
| 3 | Get Order by ID | GET | `/api/orders/:id` | - | `{success: true, data: {...}}` | ⬜ |
| 4 | Cancel Order | POST | `/api/orders/:id/cancel` | - | `{success: true}` | ⬜ |

---

## 7. Order Management - Admin Operations

| # | Action | Method | Endpoint | Request Body | Expected Response | Status |
|---|--------|--------|----------|--------------|-------------------|--------|
| 1 | Get All Orders | GET | `/api/orders/admin/all?page=1&limit=10` | - | `{success: true, data: [...]}` | ⬜ |
| 2 | Get Order by ID | GET | `/api/orders/:id` | - | `{success: true, data: {...}}` | ⬜ |
| 3 | Confirm Order | PUT | `/api/orders/:id/status` | `{"orderStatus":"CONFIRMED"}` | `{success: true}` | ⬜ |
| 4 | Ship Order | PUT | `/api/orders/:id/status` | `{"orderStatus":"SHIPPING"}` | `{success: true}` | ⬜ |
| 5 | Mark Delivered | PUT | `/api/orders/:id/status` | `{"orderStatus":"FULFILLED"}` | `{success: true}` | ⬜ |
| 6 | Cancel Order | PUT | `/api/orders/:id/status` | `{"orderStatus":"CANCELLED"}` | `{success: true}` | ⬜ |

---

## 8. Order Status Flow

| Status | Description | Who Can Set |
|--------|-------------|-------------|
| `CREATED` | Order placed | User (auto) |
| `CONFIRMED` | Order confirmed | Admin |
| `SHIPPING` | Order shipped | Admin |
| `FULFILLED` | Order delivered | Admin |
| `CANCELLED` | Order cancelled | User (before shipping) / Admin |

---

## 9. Error Responses

| Status Code | Error | Response |
|-------------|-------|----------|
| 400 | Bad Request | `{message: "...", status: 400}` |
| 401 | Unauthorized | `{message: "Unauthorized", status: 401}` |
| 403 | Forbidden | `{message: "Forbidden", status: 403}` |
| 404 | Not Found | `{message: "...", status: 404}` |
| 500 | Server Error | `{message: "...", status: 500}` |

---

## 10. Expected Response Format

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Request success status |
| `message` | string | Optional message |
| `data` | object/array | Response data |
| `pagination` | object | Pagination info (for lists) |
| `status` | number | HTTP status code |

---

## 11. Pagination Response Format

| Field | Type | Description |
|-------|------|-------------|
| `totalDocs` | number | Total number of documents |
| `limit` | number | Items per page |
| `page` | number | Current page number |
| `totalPages` | number | Total number of pages |
| `hasNextPage` | boolean | Has next page |
| `hasPrevPage` | boolean | Has previous page |
| `nextPage` | number/null | Next page number |
| `prevPage` | number/null | Previous page number |
