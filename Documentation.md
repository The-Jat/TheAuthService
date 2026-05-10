## Overview
This project is a centralized OAuth-style authentication service built using:
- NestJS backend
- Nest.js frontend
- PostgreSQL database
- JWT-based authentication
- Authorization Code Flow
- Refresh Token Rotation
- Role & Scope-based authorization
- Multi-project support

This system allows multiple external applications to authenticate users through a single centralized auth provider.

## Workflow
### Step 1: User Clicks Login
User visits external application:
```
http://localhost:3000/auth/authorize
    ?client_id=client123
    &redirect_uri=http://localhost:3000/callback
```

### Step 2: Auth Service Validates Client
Endpoint:
```
GET /auth/authorize
```

Backend validates:
- client exists
- redirect_uri matches registered app

### Step 3: Redirect to Auth Frontend
Backend redirects user to frontend login page:
```
http://localhost:3001/login
    ?client_id=client123
    &redirect_uri=http://localhost:3000/callback
```

### Step 4: User Logs In
Frontend page:
```
/login
```
User enters:
- email
- password

Frontend sends:
```
POST /auth/login
```
Payload:
```
{
  "email": "user@example.com",
  "password": "password",
  "client_id": "client123",
  "redirect_uri": "http://localhost:3000/callback"
}
```
### Step 5: Backend Validates User
Process:
1. Find user by email
2. Compare password using bcrypt
3. Return user if valid

### Step 6: Generate Authorization Code
Creates:
- random code
- expiration time
- linked client
- linked user
Stored in:
```
auth_codes
```
### Step 7: Redirect Back to Client
Backend returns:
```
{
  "redirect_to": "http://localhost:3000/callback?code=abc123"
}
```
Fronend executes:
``` TypeScript
window.location.href = data.redirect_to;
```

### Step 8: Client Exchanges Code for Tokens
External app sends:
```
POST /auth/tokens
```

Payload:
```
{
  "code": "abc123",
  "client_id": "client123",
  "client_secret": "secret123",
  "redirect_uri": "http://localhost:3000/callback"
}
```

### Step 9: Backend Validates Code
Backend validates:
- code exists
- not expired
- client_id matches
- client_secret matches
- redirect_uri matches

### Step 10: Generate Tokens
Inside:
```TypeScript
tokenService.generateAccessToken()
tokenService.generateRefreshToken()
```
Returns:
```JSON
{
  "access_token": "jwt_access",
  "refresh_token": "jwt_refresh"
}
```

## Token Types

### Access Token
Short-lived JWT.

Used for:
- protected APIs
- user profile
- scopes
- roles

Expiry:
```
15 minutes
```

### Refresh Token
Long-lived token

Used for:
- generate new access tokens

Stored in DB:
```
refresh_tokens
```

Expiry:
```
7 days
```

## Refresh Token Rotation
When refresh happens:
1. old refresh token deleted
2. new refresh token generated
3. new token stored
This prevents:
- token replay attacks
- stolen refresh token reuse

## Logout Flow
Endpoint:
```
POST /auth/logout
```

Backend:
1. deletes refresh token
2. backlists access token

Stored in:
```
token_blacklist
```

## Authorization Guard
File:
```
jwt.guard.ts
```

Responsibilities:
- extract bearer toekn
- verify JWT
- check blacklist
- attach payload to request

## Roles Guard
File:
```
roles.guard.ts
```

Checks:
```
@Roles('admin')
```

## Database Tables
### users
Stores users
```
| Column   | Purpose         |
| -------- | --------------- |
| id       | User ID         |
| email    | User email      |
| password | Hashed password |
| name     | User name       |
| role     | User role       |
```

### apps
Stores OAuth clients.
```
| Column        | Purpose          |
| ------------- | ---------------- |
| client_id     | Public client ID |
| client_secret | Secret           |
| redirect_uri  | Callback         |
| scopes        | Allowed scopes   |
```

### auth_codes
Temporary authorization codes.

### refresh_tokens
Stores active refresh tokens.

### token_blacklist
Stores revoked access tokens.

### API Endpoints
### Authentication

Signup
```
POST /auth/signup
```
Payload:
```
{
  "email": "shiv@example.com",
  "password": "password123",
  "name": "Shiva"
}
```
Response:
```JSON
{
  "id": 1,
  "email": "shiv@example.com"
}
```
Then frontend redirect to the `/login`

Login
```
POST /auth/login
```
Payload:
```JSON
{
  "email": "shiv@example.com",
  "password": "password123",
  "client_id": "client123",
  "redirect_uri": "http://localhost:3000/callback"
}
```
Response:
```
{
  "redirect_to": "http://localhost:3000/callback?code=abc123"
}
```

Exchange Token
```
POST /auth/token
```
Payload:
```JSON
{
  "code": "abc123",
  "client_id": "client123",
  "client_secret": "secret123",
  "redirect_uri": "http://localhost:3000/callback"
}
```
Response:
```
{
  "access_token": "jwt",
  "refresh_token": "jwt"
}
```

Refresh Token
```
POST /auth/refresh
```
Payload:
```JSON
{
  "refresh_token": "jwt_refresh"
}
```

Logout
```
POST /auth/logout
```
Payload:
```JSON
{
  "refresh_token": "jwt_refresh",
  "access_token": "jwt_access"
}
```

Current User
```
GET /auth/me
```
Headers:
```
Authorization: Bearer ACCESS_TOKEN
```
Response:
```JSON
{
  "id": 1,
  "email": "shiv@example.com",
  "name": "Shiv"
}
```