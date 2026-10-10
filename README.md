# ft_transcendence

*A full-stack social web platform with real-time chat, built as the final team project of the 42 common core.*

> 🚧 **In active development.** See [`docs/DEV_DOC.md`](docs/DEV_DOC.md) for developer notes.

## Features

- **Accounts and auth**: register and log in with JWT access and refresh tokens, plus **42 OAuth** login
- **Profiles**: public profiles, search, friends and relationships, online presence
- **Real-time chat** over Socket.IO, with notifications
- **Moderation**: user reports, a review workflow, an action history and an admin dashboard
- **Gamification** components
- **GDPR**: data export and account deletion with email confirmation, plus legal and terms pages

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4, Zustand |
| Backend | NestJS 11, Prisma 7, Socket.IO |
| Database | PostgreSQL 16 (pgAdmin for development) |
| Infra | Docker Compose, NGINX reverse proxy with HTTPS, Mailpit for test emails |

## Run it locally

Requirements: Docker with the Compose plugin, and `make`.

```bash
make            # generates a self-signed certificate, then builds and starts every service
make logs       # follow the logs
make down       # stop the stack
make fclean     # stop and remove volumes and images
```

| Service | URL |
|---|---|
| App | https://localhost:8443 |
| Mailpit (test inbox) | https://localhost:8025 |
| pgAdmin | http://127.0.0.1:5050 |

## Repository layout

```text
apps/
  frontend/   Next.js app (src/app routes, src/features/* modules)
  backend/    NestJS API (auth, users, chat, moderation, notifications, mail…)
infra/        NGINX and pgAdmin configuration
docs/         Developer documentation
testing/      Python end-to-end and API test scripts
```

## Team

[ElkiaCode](https://github.com/ElkiaCode) · [LaGuigue06](https://github.com/LaGuigue06) · [patsyMn](https://github.com/patsyMn) · [yannou344](https://github.com/yannou344) · [remyd06](https://github.com/remyd06), 42 Nice.
