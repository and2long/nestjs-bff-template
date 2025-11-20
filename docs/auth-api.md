# Auth API

## `POST /api/auth/login`

Request Body:

```json
{
  "provider": "password",
  "display_name": "Ada",
  "email": "ada@example.com",
  "is_anonymous": false,
  "uid": "firebase-uid"
}
```

On success the API returns:

```json
{
  "access": "<jwt access token>",
  "refresh": "<jwt refresh token>",
  "user": {
    "id": 1,
    "uid": "firebase-uid",
    "provider": "password",
    "displayName": "Ada",
    "email": "ada@example.com",
    "isAnonymous": false,
    "credits": 110
  }
}
```

If the user already exists (matched by `uid`) the existing record is returned; otherwise a new record is created before generating tokens.

---

## `POST /api/auth/refresh`

Call this when an access token has expired to exchange a valid refresh token for a new access token. If the refresh token has more than five days of validity remaining, the same refresh token is returned; otherwise a new refresh token is issued.

```json
{
  "refresh": "<jwt refresh token>"
}
```

```json
{
  "access": "<jwt access token>",
  "refresh": "<jwt refresh token>"
}
```

This endpoint never returns user profile data—clients should cache it from the login response.
