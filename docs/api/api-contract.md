# API Contract & Endpoint Specification

**Project**: TaskFlow Orchestrator  
**Phase**: 1 — Requirements, Architecture & Design  
**Document Status**: Reviewed & Corrected Baseline  
**Base URL**: `http://localhost:8000/api/v1`  
**Protocol**: REST / JSON over HTTPS  
**Authentication**: HTTP Bearer Header (`Authorization: Bearer <JWT>`)

---

## 1. Global Security & JWT Standards

All protected endpoints require a cryptographically signed JSON Web Token (JWT) transmitted via the standard `Authorization` header:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 1.1 Strict JWT Claims Contract
All issued and verified access tokens must contain the following six mandatory claims. The verification layer enforces HS256 and rejects any token missing any required claim with `401 Unauthorized`:

| Claim Key | Name | Data Type | Specification & Validation Rule |
| :--- | :--- | :--- | :--- |
| `sub` | Subject | `string` (UUID) | String representation of the authenticated user's UUID. |
| `exp` | Expiration Time | `integer` (Epoch) | UTC epoch seconds. Baseline expiry is strictly **30 minutes (1800 seconds)** from issuance. Expired tokens are rejected. |
| `iat` | Issued At | `integer` (Epoch) | UTC epoch seconds of token generation. |
| `iss` | Issuer | `string` | Must equal `"taskflow-orchestrator"`. Tokens with mismatched issuers are rejected. |
| `aud` | Audience | `string` | Must equal `"taskflow-api"`. Tokens with mismatched audiences are rejected. |
| `type` | Token Classification | `string` | Must equal `"access"`. Refresh tokens or generic tokens are rejected. |

### 1.2 Global Error Response Schema
All error responses adhere to the standard JSON structure:

```json
{
  "detail": "Descriptive explanation of the validation, authentication, or operational error."
}
```

---

## 2. Authentication Endpoints

### 2.1 Register User Account
Creates a new tenant user identity. Securely hashes the password with bcrypt (work factor 12).

- **Route**: `POST /api/v1/auth/register`
- **Auth Required**: **NO** (Public Ingress)
- **Request Content-Type**: `application/json`

#### Request Body
```json
{
  "email": "alice@example.com",
  "password": "SecurePassword123!",
  "full_name": "Alice Architect"
}
```
*Constraints*:
- `email`: Valid RFC 5322 format, max 255 chars. Automatically trimmed and lowercased.
- `password`: Minimum 8 characters, maximum 128 characters.
- `full_name`: Optional string, max 255 characters.

#### Responses
- **`201 Created`**: Registration successful.
  ```json
  {
    "id": "a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d",
    "email": "alice@example.com",
    "full_name": "Alice Architect",
    "is_active": true,
    "created_at": "2026-10-31T03:00:00.000Z",
    "updated_at": "2026-10-31T03:00:00.000Z"
  }
  ```
  *Security Invariant*: `password_hash` is **never** serialized or exposed in the response.
- **`409 Conflict`**: Email already registered.
  ```json
  { "detail": "An account with this email address already exists." }
  ```
- **`422 Unprocessable Entity`**: Password < 8 characters or invalid email format.

---

### 2.2 Login & Token Issuance
Authenticates user credentials against the stored bcrypt hash and returns a signed HS256 JWT access token.

- **Route**: `POST /api/v1/auth/login`
- **Auth Required**: **NO** (Public Ingress)
- **Request Content-Type**: `application/json` *(Primary API contract)*

#### Request Body (`application/json`)
```json
{
  "email": "alice@example.com",
  "password": "SecurePassword123!"
}
```

#### Responses
- **`200 OK`**: Authentication successful.
  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "bearer",
    "expires_in_seconds": 1800,
    "user": {
      "id": "a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d",
      "email": "alice@example.com",
      "full_name": "Alice Architect",
      "is_active": true,
      "created_at": "2026-10-31T03:00:00.000Z",
      "updated_at": "2026-10-31T03:00:00.000Z"
    }
  }
  ```
- **`401 Unauthorized`**: Incorrect email or password (uniform message to prevent account enumeration).
  ```json
  { "detail": "Incorrect email or password." }
  ```
- **`403 Forbidden`**: User account is soft-deactivated (`is_active == false`).
  ```json
  { "detail": "User account is deactivated." }
  ```

---

### 2.3 Retrieve Current User Profile
- **Route**: `GET /api/v1/auth/me`
- **Auth Required**: **YES** (`Bearer <token>`)
- **Responses**:
  - **`200 OK`**: Authenticated `UserResponse` object.
  - **`401 Unauthorized`**: Missing, expired, or tampered token.

---

## 3. Task Management Endpoints (ADR-002 Scoped)

### 3.1 Task Lifecycle & State Transitions
Permitted states: `pending`, `in_progress`, `completed`, `archived`.

```
[ pending ] ──► [ in_progress ] ──► [ completed ]
     │                │                    │
     └────────────────┴────────────────────┴──► [ archived ]
```

---

### 3.2 Create Task
- **Route**: `POST /api/v1/tasks`
- **Auth Required**: **YES** (`Bearer <token>`)
- **Request Content-Type**: `application/json`

#### Request Body
```json
{
  "title": "Set up PostgreSQL read-replicas",
  "description": "Architect read pool for ADR-002 high concurrency",
  "status": "pending",
  "priority": "high",
  "due_date": "2026-11-15T18:00:00.000Z"
}
```
*Constraints*:
- `title`: String, min 1, max 200 (Required).
- `description`: String, max 5000 (Optional, nullable).
- `status`: Enum (`pending`, `in_progress`, `completed`, `archived`). Default: `pending`.
- `priority`: Enum (`low`, `medium`, `high`, `urgent`). Default: `medium`.
- `due_date`: Timezone-aware ISO-8601 UTC timestamp (Optional, nullable).

#### Responses
- **`201 Created`**: Returns newly created `TaskResponse` with `user_id` bound to `current_user.id`.
- **`401 Unauthorized`**: Missing or invalid token.
- **`422 Unprocessable Entity`**: Validation failure (empty title or invalid enum).

---

### 3.3 List Tasks (Filtered & Paginated)
- **Route**: `GET /api/v1/tasks`
- **Auth Required**: **YES** (`Bearer <token>`)

#### Query Parameters
| Parameter | Type | Required | Default | Constraint / Description |
| :--- | :--- | :--- | :--- | :--- |
| `status` | String | No | *None* | Filter by enum: `pending`, `in_progress`, `completed`, `archived` |
| `priority` | String | No | *None* | Filter by enum: `low`, `medium`, `high`, `urgent` |
| `limit` | Integer | No | `20` | Page size ceiling: minimum `1`, maximum `100` |
| `offset` | Integer | No | `0` | Records to skip: minimum `0` |

#### Response (`200 OK`)
```json
{
  "items": [
    {
      "id": "e9b2c3d4-1111-2222-3333-444455556666",
      "user_id": "a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d",
      "title": "Set up PostgreSQL read-replicas",
      "description": "Architect read pool for ADR-002 high concurrency",
      "status": "pending",
      "priority": "high",
      "due_date": "2026-11-15T18:00:00.000Z",
      "created_at": "2026-10-31T03:00:00.000Z",
      "updated_at": "2026-10-31T03:00:00.000Z"
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

---

### 3.4 Get Task by ID
- **Route**: `GET /api/v1/tasks/{task_id}`
- **Auth Required**: **YES** (`Bearer <token>`)
- **Responses**:
  - **`200 OK`**: Returns `TaskResponse`.
  - **`404 Not Found`**: Task does not exist OR belongs to another tenant (Anti-Enumeration Guard).

---

### 3.5 Partially Update Task (PATCH)
- **Route**: `PATCH /api/v1/tasks/{task_id}`
- **Auth Required**: **YES** (`Bearer <token>`)
- **Request Content-Type**: `application/json`

#### Omitted vs. Null Field Semantics (Strict Contract)
1. **Omitted Field**: Any field not present in the JSON body is ignored and remains untouched in the database.
2. **Explicit `null` on Nullable Fields (`description`, `due_date`)**: Clears the database column to `NULL`.
3. **Explicit `null` on Non-Nullable Fields (`title`, `status`, `priority`)**: Rejected with `422 Unprocessable Entity`.

#### Responses
- **`200 OK`**: Returns updated `TaskResponse` with incremented `updated_at`.
- **`404 Not Found`**: Task does not exist OR belongs to another tenant.
- **`422 Unprocessable Entity`**: Invalid update data.

---

### 3.6 Delete Task
- **Route**: `DELETE /api/v1/tasks/{task_id}`
- **Auth Required**: **YES** (`Bearer <token>`)
- **Responses**:
  - **`204 No Content`**: Deletion successful (empty body).
  - **`404 Not Found`**: Task does not exist OR belongs to another tenant.

---

## 4. HTTP Status Code Summary Matrix

| HTTP Status | Name | Meaning in TaskFlow Orchestrator |
| :--- | :--- | :--- |
| **`200 OK`** | Success | Request succeeded; response contains requested data entity. |
| **`201 Created`** | Created | Resource (User or Task) successfully created and persisted. |
| **`204 No Content`** | Deleted | Resource deleted successfully; response body is empty. |
| **`401 Unauthorized`** | Auth Failure | Missing, expired, untrusted, or tampered JWT; or incorrect credentials. |
| **`403 Forbidden`** | Access Denied | Account deactivated by administrative action (`is_active == false`). |
| **`404 Not Found`** | Not Found | Resource does not exist OR belongs to another tenant (Anti-Enumeration). |
| **`409 Conflict`** | Conflict | Duplicate resource conflict (e.g. email address already registered). |
| **`422 Unprocessable`**| Validation Error| Pydantic v2 schema failure (field bounds, regex, enum mismatch). |
| **`500 Internal Error`**| Server Error | Unexpected internal exception; internal trace masked in production. |
