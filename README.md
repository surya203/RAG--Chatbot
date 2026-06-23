# RAG Chatbot — Student PDF Knowledge Base (SaaS)

A multi-user RAG chatbot for students to chat with PDF knowledge bases. Phase 1 delivers **JWT login authentication**.

## Project Structure

```
RAG--Chatbot/
├── backend/          # FastAPI + PostgreSQL + JWT
└── frontend/         # React + TypeScript + Tailwind + Shadcn UI
```

## Phase 1 — Login (Current)

- JWT access + refresh tokens on login
- Protected `/api/v1/users/me` endpoint
- React login page with auth context and protected routes
- Placeholder dashboard after login

**Coming next:** Registration, refresh token rotation, password reset, email verification, profile management.

---

## Backend Setup

### Prerequisites

- Python 3.11+
- PostgreSQL (Supabase, Neon, or local)

### 1. Configure environment

```bash
cd backend
cp .env.example .env
```

Edit `.env` with your database URL and a strong secret:

```env
DATABASE_URL=postgresql://user:password@host:5432/your_db
SECRET_KEY=your-long-random-secret-key
CORS_ORIGINS=http://localhost:5173
```

### 2. Install dependencies

```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
```

### 3. Run migrations

```bash
alembic upgrade head
```

### 4. Seed a test student (optional)

```bash
python -m scripts.seed_user
# Or with custom credentials:
python -m scripts.seed_user student@university.edu mypassword123 "Jane Student"
```

Default test account: `student@example.com` / `password123`

### 5. Start the API

```bash
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

---

## Frontend Setup

### Prerequisites

- Node.js 18+

### 1. Configure environment

```bash
cd frontend
cp .env.example .env
```

### 2. Install and run

```bash
npm install
npm run dev
```

App: http://localhost:5173

---

## API Endpoints (Phase 1)

| Method | Endpoint              | Description                    |
|--------|-----------------------|--------------------------------|
| POST   | `/api/v1/auth/login`  | Login with email + password    |
| GET    | `/api/v1/users/me`    | Current user (Bearer token)    |
| GET    | `/health`             | Health check                   |

### Login request

```json
{
  "email": "student@example.com",
  "password": "password123"
}
```

### Login response

```json
{
  "user": {
    "id": "...",
    "email": "student@example.com",
    "full_name": "Test Student",
    "is_verified": true
  },
  "tokens": {
    "access_token": "...",
    "refresh_token": "...",
    "token_type": "bearer"
  }
}
```

---

## Tech Stack (Planned)

| Layer      | Technology                                      |
|------------|-------------------------------------------------|
| Frontend   | React, TypeScript, Tailwind, Shadcn, React Query |
| Backend    | FastAPI, SQLAlchemy, Alembic, JWT               |
| Database   | PostgreSQL (+ pgvector later)                   |
| AI         | LangChain, ChromaDB → pgvector, Groq/OpenAI     |
| Deploy     | Vercel (FE), Render/Railway (BE), Supabase/Neon |

## Roadmap

1. **Phase 1** — Auth (login ✅ → register, refresh, password reset, email verify)
2. **Phase 2** — PDF upload, chunking, embeddings, vector search
3. **Phase 3** — Chat with streaming (WebSocket/SSE), chat history
4. **Phase 4** — Voice I/O, AI summarise, random quiz
5. **Phase 5** — SaaS billing, multi-tenant, deployment
