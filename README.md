# Time Flow

AI-powered backend untuk Time Blocking — jadwal, konflik, burnout detection, dan optimasi lewat natural language.

**Stack:** Bun · ElysiaJS · Drizzle · PostgreSQL · OpenAI

---

## Quick Start

```bash
bun install
cp .env.example .env   # isi DATABASE_URL, OPENAI_API_KEY, JWT_SECRET
bun run db:push
bun run dev
```

→ http://localhost:3000 | Docs: http://localhost:3000/openapi

---

## Setup

| Langkah | Perintah |
|---------|----------|
| Install | `bun install` |
| Env | `cp .env.example .env` → edit `DATABASE_URL`, `OPENAI_API_KEY`, `JWT_SECRET` |
| DB | PostgreSQL aktif → `bun run db:push` |
| Run | `bun run dev` |

### Docker

```bash
docker compose up -d
# App: :3000 | DB: :5432 (postgres/postgres)
```

---

## API (Ringkas)

| Endpoint | Deskripsi |
|----------|-----------|
| `POST /auth/register` | Daftar (email + password) |
| `POST /auth/sign-in` | Login, dapat JWT |
| `GET /user/profile` | Profil *(auth)* |
| `PATCH /user/settings` | Buffer, timezone *(auth)* |
| `GET /schedules?date=&analyze=` | List jadwal, burnout, triage *(auth)* |
| `GET /schedules/audit` | Audit log AI vs USER *(auth)* |
| `POST/PATCH/DELETE /schedules` | CRUD jadwal *(auth)* |
| `POST /ai/prompt` | Parse teks → draft jadwal *(auth)* |
| `POST /ai/optimize` | Optimasi jadwal harian *(auth)* |
| `POST /ai/confirm` | Simpan draft AI ke DB *(auth)* |

Dokumentasi lengkap: **GET /openapi**

---

## Auth (JWT)

```bash
# Register
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"secret123"}'

# Sign in → ambil token
curl -X POST http://localhost:3000/auth/sign-in \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"secret123"}'

# Panggil API dengan token
curl -H "Authorization: Bearer <token>" http://localhost:3000/user/profile
```

---

## Fitur

- **Conflict Detection** — tolak jadwal bentrok, saran slot alternatif
- **Buffer** — jeda otomatis antar aktivitas
- **AI NLP** — "Besok meeting jam 2" → draft jadwal
- **Burnout Detection** — peringatan kerja >3 jam tanpa istirahat
- **Triage** — saran pindah tugas saat hari overload
- **Audit Trail** — log perubahan AI vs USER
- **Rate Limit** — max 10 AI requests/menit per user

---

## Test

```bash
bun test
```
