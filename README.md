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

# Edit .env dengan connection string PostgreSQL Anda
# DATABASE_URL=postgres://user:pass@localhost:5432/timeflow

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
| POST | `/auth/register` | Daftar user (dev) |
| GET | `/user/profile` | Profil user *(auth)* |
| PATCH | `/user/settings` | Update buffer, timezone *(auth)* |
| GET | `/schedules?date=YYYY-MM-DD` | List jadwal *(auth)* |
| POST | `/schedules` | Tambah jadwal *(auth)* |
| PATCH | `/schedules/:id` | Update jadwal *(auth)* |
| DELETE | `/schedules/:id` | Hapus jadwal *(auth)* |

### Auth (Phase 1)

Gunakan header `x-user-id: <uuid>` dengan UUID user dari `/auth/register`.

```bash
# 1. Daftar user
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com"}'

# 2. Gunakan id yang dikembalikan
curl http://localhost:3000/user/profile -H "x-user-id: <uuid>"
```

## Testing

```bash
bun test
```

## Phase 2: Conflict & Alternatives

When `POST /schedules` or `PATCH /schedules/:id` detects a conflict, the 409 response includes:

- `alternativeSlots`: Suggested time slots that fit (with buffer respected)
