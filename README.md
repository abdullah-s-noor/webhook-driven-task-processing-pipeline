# WebhookPipe

Webhook processing platform (Frontend + Backend + Worker + PostgreSQL) for managing:
- Pipelines
- Steps
- Subscribers
- Jobs
- Deliveries
- Metrics

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Folder Structure](#folder-structure)
- [Features](#features)
- [Job and Delivery Status](#job-and-delivery-status)
- [Prerequisites](#prerequisites)
- [Running the App](#running-the-app)
- [Database and Migrations](#database-and-migrations)
- [API Documentation](#api-documentation)
- [Quick cURL Examples](#quick-curl-examples)
- [Step Types](#step-types)
- [Scripts](#scripts)
- [Operational Notes](#operational-notes)
- [Troubleshooting](#troubleshooting)
- [Database Diagram (ERD)](#database-diagram-erd)

## Overview

This repository is a monorepo with:
- `backend/`: REST API, database access, and worker logic.
- `frontend/`: React/Vite dashboard.
- `docker-compose.yml`: full stack runtime (Postgres + backend + worker + frontend).

Main flow:
1. User logs in.
2. User creates a pipeline.
3. User adds steps and subscribers.
4. User sends a test payload (creates a job).
5. Worker processes the job steps.
6. On success, deliveries are created for subscribers.
7. Delivery worker sends webhooks with retries.

## Tech Stack

- Backend: Express 5, TypeScript, Drizzle ORM, PostgreSQL, JWT
- Frontend: React 19, TypeScript, Vite
- Infra: Docker, Docker Compose

## Architecture

### Backend
- Express 5
- Drizzle ORM + PostgreSQL
- JWT authentication
- Polling workers (job poller + delivery poller)

Important folders:
- `backend/src/api`: routes, handlers, middleware
- `backend/src/db`: schema, queries, migrations
- `backend/src/worker`: pollers and processors
- `backend/src/steps`: step executors

### Frontend
- React 19 + TypeScript + Vite
- Main pages:
  - `Pipelines`
  - `Jobs`
  - `Metrics`
- Job details are rendered in `JobDetailsDialog`

## Folder Structure

- `backend/src/api`: routes, handlers, middleware
- `backend/src/db`: schema, queries, migrations
- `backend/src/worker`: pollers and processors
- `backend/src/steps`: step executors
- `frontend/src/pages`: app pages
- `frontend/src/components`: reusable UI components
- `frontend/src/services`: API clients

## Features

- Pipeline CRUD.
- Pipeline step CRUD (including edit mode inside pipeline details).
- Subscriber CRUD.
- Manual job creation through "Send test webhook".
- Job diagnostics (especially for failed jobs).
- Deliveries and attempts visible inside Job Details dialog.
- "Refresh" button in Deliveries section inside Job dialog.
- Metrics page (global and per pipeline).
- UI status simplification: `queued + processing` displayed as `pending`.
- Deliveries sidebar section removed from Pipeline page.

## Job and Delivery Status

### Job status in database
- `pending`
- `processing`
- `processed`
- `failed`

### Job status in UI
- `succeeded` (mapped from `processed`)
- `failed`
- `pending` (mapped from `pending` + `processing`)

### Delivery status
- `pending`
- `success`
- `failed`

### Delivery retry policy (worker)
- Attempt 1: immediate (0s)
- Attempt 2: after 10s
- Attempt 3: after 20s
- Then marked `failed`

## Prerequisites

- Node.js 22+
- PostgreSQL 16+
- Docker (optional, recommended for fastest setup)

## Running the App

### Fastest Option: Docker Compose

From repository root:

```bash
docker compose up --build
```

Services:
- Frontend: `http://localhost:5173`
- Backend API: `http://51.20.5.15`
- PostgreSQL: `localhost:5432`

---

### Local Development (without Docker)

### 1) Backend

```bash
cd backend
npm ci
```

Create/update `backend/.env`:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgres://postgres:postgres@localhost:5432/webhookpipe
JWT_SECRET=change-me
WORKER_POLL_INTERVAL_MS=5000
MAX_DELIVERY_ATTEMPTS=3
DELIVERY_TIMEOUT_MS=10000
```

Notes:
- In Docker setup, `DATABASE_URL` host is `postgres`.
- For local DB, use `localhost`.

Run API:

```bash
npm run dev
```

Run worker (second terminal):

```bash
npm run worker
```

### 2) Frontend

```bash
cd frontend
npm ci
npm run dev
```

Frontend service clients currently target `http://51.20.5.15`.

## Database and Migrations

From `backend`:

```bash
npm run generate
npm run migrate
```

Migrations live in:
- `backend/src/db/migrations`

## API Documentation

All endpoints below (except `/auth/*` and `/test`) require:
- `Authorization: Bearer <token>`

### Auth
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`

### Pipelines
- `POST /pipelines`
- `GET /pipelines`
- `GET /pipelines/:id`
- `DELETE /pipelines/:id` (soft delete via `isActive=false`)

### Pipeline Steps
- `POST /pipeline-steps`
- `GET /pipeline-steps/pipeline/:pipelineId`
- `GET /pipeline-steps/:id`
- `PUT /pipeline-steps/:id`
- `DELETE /pipeline-steps/:id`

### Subscribers
- `POST /subscribers`
- `GET /subscribers/pipeline/:pipelineId`
- `GET /subscribers/:id`
- `PUT /subscribers/:id`
- `DELETE /subscribers/:id`

### Jobs
- `POST /jobs`
- `GET /jobs/pipeline/:pipelineId`
- `GET /jobs/:id`

### Deliveries
- `GET /deliveries/pipeline/:pipelineId`
- `GET /deliveries/:deliveryId/attempts`

### Health/Test
- `GET /test`

## Quick cURL Examples

### Register
```bash
curl -X POST http://51.20.5.15/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"12345678"}'
```

### Login
```bash
curl -X POST http://51.20.5.15/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"12345678"}'
```

### Create Pipeline
```bash
curl -X POST http://51.20.5.15/pipelines \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"name":"Order Validator"}'
```

### Add Step
```bash
curl -X POST http://51.20.5.15/pipeline-steps \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{
    "pipelineId":"<PIPELINE_ID>",
    "type":"filter",
    "order":0,
    "config":{"conditions":[{"field":"price","op":"gt","value":100}]}
  }'
```

### Add Subscriber
```bash
curl -X POST http://51.20.5.15/subscribers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"pipelineId":"<PIPELINE_ID>","url":"https://example.com/webhook"}'
```

### Create Job
```bash
curl -X POST http://51.20.5.15/jobs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{
    "pipelineId":"<PIPELINE_ID>",
    "payload":{"firstName":"Ahmed","price":250,"branch":"main","qty":2}
  }'
```

## Step Types

Accepted step types on the API:
- `require_fields`
- `filter`
- `transform`
- `set_fields`
- `enrich`
- `calculate_field`
- `pick_fields`
- `delay`
- `deliver`

Important note:
- Worker execution is currently implemented for:
  `require_fields`, `filter`, `transform`, `set_fields`, `enrich`, `calculate_field`, `pick_fields`.
- `delay` and `deliver` are valid in API type validation but are not registered in runtime `stepRegistry`.

## Scripts

### Backend (`backend/package.json`)
- `npm run dev` - run API with tsx
- `npm run worker` - run worker
- `npm run build` - TypeScript build
- `npm run start` - run compiled output
- `npm run test` - Jest tests
- `npm run generate` - Drizzle generate
- `npm run migrate` - Drizzle migrate

### Frontend (`frontend/package.json`)
- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run preview`

## Operational Notes

- Worker must be running; otherwise jobs/deliveries remain pending.
- Pipeline delete is soft delete (`isActive=false`).
- `sourceUrl` is auto-generated as a local placeholder URL.
- In current UI:
  - Deliveries are no longer a standalone sidebar page.
  - Delivery details are shown inside Job Details dialog.

## Troubleshooting

- UI cannot reach API:
  - Ensure backend is running on port `3000`.
  - Verify CORS/ports in Docker or local setup.

- Jobs stay pending:
  - Ensure worker is running.
  - Check worker logs.

- Deliveries remain pending:
  - Ensure subscriber URL is valid and reachable.
  - Inspect `delivery_attempts` errors.

## Database Diagram (ERD)

```mermaid
erDiagram
    USERS {
      uuid id PK
      varchar email UK
      text password_hash
      timestamp created_at
    }

    PIPELINES {
      uuid id PK
      uuid user_id FK
      varchar name
      text source_url UK
      text signing_secret
      boolean is_active
      timestamp created_at
      timestamp updated_at
    }

    PIPELINE_STEPS {
      uuid id PK
      uuid pipeline_id FK
      varchar type
      jsonb config
      int order
      timestamp created_at
      timestamp updated_at
    }

    SUBSCRIBERS {
      uuid id PK
      uuid pipeline_id FK
      text url
      timestamp created_at
    }

    JOBS {
      uuid id PK
      uuid pipeline_id FK
      jsonb payload
      jsonb steps_snapshot
      jsonb processed_payload
      enum status
      text filter_reason
      int attempt_count
      timestamp created_at
      timestamp updated_at
      timestamp processed_at
    }

    DELIVERIES {
      uuid id PK
      uuid job_id FK
      uuid subscriber_id FK
      enum status
      int attempt_count
      timestamp last_attempt_at
    }

    DELIVERY_ATTEMPTS {
      uuid id PK
      uuid delivery_id FK
      int attempt_number
      int status_code
      text error
      timestamp attempted_at
    }

    USERS ||--o{ PIPELINES : owns
    PIPELINES ||--o{ PIPELINE_STEPS : has
    PIPELINES ||--o{ SUBSCRIBERS : has
    PIPELINES ||--o{ JOBS : receives
    JOBS ||--o{ DELIVERIES : creates
    SUBSCRIBERS ||--o{ DELIVERIES : target
    DELIVERIES ||--o{ DELIVERY_ATTEMPTS : logs
```

