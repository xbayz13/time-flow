# Time Flow — AI-Powered Dynamic Time Blocker

Backend API untuk manajemen jadwal berbasis Time Blocking dengan AI.

**Tech Stack:** Bun, ElysiaJS, Drizzle ORM, PostgreSQL

## Setup

### 1. Install dependencies

```bash
bun install
```

### 2. Database

Pastikan PostgreSQL berjalan, lalu:

```bash
# Copy env example
cp .env.example .env

# Edit .env:
# DATABASE_URL=postgres://user:pass@localhost:5432/timeflow
# OPENAI_API_KEY=... (untuk AI)
# JWT_SECRET=... (min 32 karakter, untuk auth)

# Push schema ke database
bun run db:push
```

### 3. Development

```bash
bun run dev
```

Server berjalan di http://localhost:3000

## API

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/` | Info API |
| POST | `/auth/register` | Daftar user (email + password) |
| POST | `/auth/sign-in` | Login, dapat JWT token |
| GET | `/user/profile` | Profil user *(auth)* |
| PATCH | `/user/settings` | Update buffer, timezone *(auth)* |
| GET | `/schedules?date=YYYY-MM-DD` | List jadwal *(auth)* |
| POST | `/schedules` | Tambah jadwal *(auth)* |
| PATCH | `/schedules/:id` | Update jadwal *(auth)* |
| DELETE | `/schedules/:id` | Hapus jadwal *(auth)* |

### Auth (JWT)

```bash
# 1. Register (dengan password)
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"secret123"}'

# 2. Sign in
curl -X POST http://localhost:3000/auth/sign-in \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"secret123"}'

# 3. Gunakan token di header
curl http://localhost:3000/user/profile -H "Authorization: Bearer <token>"
```

## Testing

```bash
bun test
```
