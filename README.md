*This project has been created as part of the 42 curriculum by [gurousta] [yroard] [cparodi] [pmeimoun] [rdelola].*

# Transcendence

## Description

Transcendence is a full-stack social communication platform built for the 42 curriculum. The project combines a modern React/Next.js frontend with a scalable NestJS backend, real-time chat, social relationships, moderation tools, notification delivery, and OAuth integration.

The idea originated during a team discussion about building something true to the 42 culture. Patsy, the only girl in the group, proposed creating a social network inspired by 42's visual direction and values to prevent sexist behavior. The rest of the team quickly supported the idea and extended the concept to address all forms of harassment by reproducing 42's point-based reputation system.

Key features:
- User authentication and 42 OAuth login
- Real-time direct and group chat with message reads and reactions
- Friendships, blocking, and user profile management
- Moderation workflows, reports, and admin actions
- Persistent notifications and activity updates
- PostgreSQL database with Prisma ORM, Redis for caching and session support

## Instructions

### Prerequisites
- Docker and Docker Compose installed
- Node.js and npm
- PostgreSQL and Redis are configured through Docker Compose
- A `.env` file in the repository root with required environment variables

### Required environment variables
Use the provided `.env` file as a template and update secrets before launching. Required variables include:
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_ACCESS_EXPIRES`
- `JWT_REFRESH_EXPIRES`
- `FORTYTWO_CLIENT_ID`
- `FORTYTWO_CLIENT_SECRET`
- `FORTYTWO_CALLBACK_URL`
- `REDIS_URL`
- `API_URL`
- `CORS_ORIGIN`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_SOCKET_URL`
- `NEXT_PUBLIC_42_CLIENT_ID`
- `FRONTEND_URL`
- `NODE_ENV`

### Run with Docker Compose
From the repository root:

```bash
docker compose up --build
```

This will start the following services:
- `frontend` (Next.js application)
- `backend` (NestJS API)
- `postgres` (PostgreSQL database)
- `redis` (Redis cache)
- `nginx` reverse proxy

### Using the Makefile

You can also use the provided `Makefile` to manage the development environment. Running `make` from the repository root runs the default `all` target (which calls `up`) and starts the containers.

Common `Makefile` targets:
- `all` (default): alias for `up`
- `cert`: generate local self-signed dev TLS certificate
- `folder`: create required data folders
- `up`: build and start containers in detached mode
- `down`: stop containers and remove orphans
- `re`: restart (runs `down` then `up`)
- `build`: build images
- `logs`: follow container logs
- `ps`: list running services
- `clean`: stop and remove containers, volumes and prune docker system
- `fclean`: full clean (removes certs and data directories)

Usage examples:

```bash
make /make up        : build and start container
make up              :build and start containers
make down            :stop and remove containers
make logs            :follow logs
make fclean          :full cleanup
```

### Database and seeding
The backend container runs Prisma generate and deploys migrations automatically

### Health checks and endpoints
- Backend health: `http://localhost:3001/api/health`
- Frontend: `http://localhost:3000`

## Resources

- Next.js documentation: https://nextjs.org/docs
- NestJS documentation: https://docs.nestjs.com
- Prisma documentation: https://www.prisma.io/docs
- PostgreSQL documentation: https://www.postgresql.org/docs/
- Socket.IO documentation: https://socket.io/docs/
- Docker Compose documentation: https://docs.docker.com/compose/

### AI usage
AI was used to generate and structure this README content, summarizing the repository and clarifying setup instructions. All technical details were validated against the project files.

## Team information

### Team roles

- Tech Lead: `groustan`
- Project Manager (PM): `yann`
- Product Owner (PO): `patsy`
- Developers: `clement`, `remy`, `groustan`, `yann`, `patsy`
- DevOps / Infrastructure: 
- QA / Testing: `yann`

### Team roles & responsibilities

- Tech Lead / Backend Lead: `groustan`
  - Responsible for backend architecture, Prisma schema, database design, migrations, and core API modules.

- Product Owner (PO): `patsy`
  - Responsible for product vision, feature prioritization, design direction, and final acceptance of UX decisions.

- Project Manager (PM): `yann`
  - Responsible for task coordination, sprint planning, managing Trello board, and ensuring delivery timelines.

- Backend Engineers: `groustan`, `yann`, `patsy`
  - Implement API endpoints, database integration, moderation logic, and WebSocket backend handlers. `yann` focused on WebSocket reliability and bug fixes.

- Frontend Engineers: `clement`, `remy`
  - Implement Next.js UI, chat pages, profile editing screens, state management, and integrate socket events.

- Design Lead / UX: `patsy`
  - Owns visual identity, Figma design files, accessibility decisions, and profile UX (avatar, bio, profile visibility).

- DevOps / Infrastructure: `groustan`, `remy`
  - Manage Docker Compose, nginx, TLS dev certificates, deployment scripts, and persistent volumes.

- QA / Testing: `yann`, `groustan`
  - Maintain unit and e2e test suites, run verification boards, and coordinate bug triage.

Each member contributed across multiple areas; responsibilities above indicate primary ownership. If you want different role titles or specific PO/PM assignments, tell me and I’ll update the section.

## Project management

### Organization
- Work was organized with issue tracking and milestone planning.
- Tasks were divided into backend, frontend, and integration work.
- Progress was reviewed in regular team syncs.

### Tools
- Trello for Kanban task tracking, workflow organization, and team assignment
- Figma as a collaborative workspace for project planning, module definitions, database schema design, weekly meeting notes, task distribution, agile roadmap visualization, and technical resources
- GitHub Issues and pull requests for code review, issue tracking, and version control
- Git and branch-based workflow for code changes
- Docker Compose for local environment orchestration

### Communication
- Discord for daily coordination, pair programming, and team discussions
- GitHub for code collaboration, issue discussion, and merge request review

## Technical stack

### Frontend
- Next.js 16
- React 19
- TypeScript
- CSS modules / global CSS
- Socket.IO client for real-time events

### Backend
- NestJS 11
- TypeScript
- Prisma ORM
- PostgreSQL database
- Redis cache
- Socket.IO server for real-time messaging
- Docker and nginx reverse proxy

### Database system
- PostgreSQL was chosen for relational consistency, strong support for relations and transactions, and compatibility with Prisma.
- Prisma provides a typed schema, migrations, and safe database access.

### Other technologies
- Docker Compose for reproducible local deployment
- Redis for caching and real-time state support
- 42 OAuth integration for user login

### Technical choices
- Next.js + NestJS provide a clean separation between frontend and backend while sharing TypeScript across the stack.
- PostgreSQL was selected for structured user, chat, and moderation data.
- Redis supports fast real-time session and notification workflows.
- Docker Compose simplifies environment setup for the full stack.

## Database schema

The database schema is defined in `apps/backend/prisma/schema.prisma`.

### Main tables and relations
- `User`: core account entity with authentication, roles, and penalties.
- `Profile`: user profile details including display name and avatar.
- `OAuthAccount`: external 42 login associations.
- `RefreshToken`: refresh token management for authentication.
- `Friendship`: friend request state and acceptance.
- `Block`: user block relationships.
- `Conversation` / `ConversationParticipant`: direct and group chat rooms.
- `Message`: chat messages with edit/delete state.
- `MessageRead`: message read receipts.
- `MessageReaction`: message reaction tracking.
- `Notification`: in-app notifications for users.
- `Report`: moderation reports for users or messages.
- `ModerationAction`: moderator actions and penalty tracking.

### Schema relationships
- One user can have one profile and many OAuth accounts.
- Users can send/receive friendships, block other users, and participate in conversations.
- Conversations contain messages, and participants can have roles.
- Messages support reads and reactions.
- Moderation flows connect reports, moderators, and target users/messages.

## Features

### Implemented functionality
- Authentication and 42 OAuth login
- User registration, profile management, and account state
- Friend request workflow and blocking
- Real-time chat, message history, reactions, and read receipts
- Notifications for incoming messages, friend events, and moderation updates
- Reporting and moderation actions for community safety
- Admin and health check endpoints
- Docker-based development environment with PostgreSQL and Redis

### Feature ownership
- Authentication / OAuth: `groustan`, `patsy`
- Chat system: `
- Friendship and block management:
- Notifications & moderation:
- Deployment and Docker integration:
- WebSocket reliability & bug fixes:
- Frontend UI & profile editing:
- Testing & QA:
- Documentation and onboarding:

## Modules and scoring

### Major modules (2 points each)
- Authentication / Authorization — implemented with JWT, refresh tokens, and 42 OAuth.
- Social Graph / Friendship — friend requests, accept/reject flow, and blocking.
- Real-time Chat — Socket.IO-powered direct/group chat, message history, and reactions.
- Moderation / Reporting — report creation, review states, and moderator actions.

### Minor modules (1 point each)
- Notifications — persistent notification records and unread state.
- Search / user lookup — user search and discovery.
- Storage / uploads — file storage for user uploads and avatar support.

### Implementation notes
- Major modules are implemented across backend NestJS controllers/services and frontend pages/components.
- Minor modules are integrated into UI flows and backend notification/reporting services.
- Modules were selected to demonstrate core social application behavior and moderation safety.

## Individual contributions

### `guillaume`
- Primary responsibility: backend database and infrastructure. Led Prisma schema design, migrations, seeding, and Docker orchestration.
- Implemented core data models, moderation backend logic, and parts of notifications.

### `yann`
- Primary responsibility: WebSocket infrastructure, realtime reliability, and bug fixes. Fixed multiple websocket edge-cases and improved delivery guarantees.
- Supported backend realtime handlers and assisted with load testing.

### `clement`
- Primary responsibility: frontend user interfaces and integrations. Implemented chat pages, profile editing, and many UI components.
- Worked on accessibility fixes, styling, and integrating socket events into React state.

### `remy`
- Primary responsibility: frontend engineering, tests, and CI. Built UI features alongside `clement`, maintained test suites, and helped document flows.
- Supported Docker integration, logs/monitoring, and verification tasks.

### `patsy`
- Primary responsibility: authentication flows and design direction.
- Implemented 42 OAuth, dual-auth considerations, and led the visual identity.
- Implemented profile editing features including display name editing, shareable bio, avatar upload and storage, and profile visibility settings.
- Designed and implemented the reputation/points system and leaderboard used by gamification and moderation features.
- Contributed to UI/UX polish, accessibility, and final design decisions.

### Additional completed tasks (team-wide)
- Infrastructure: nginx, TLS dev certs, Docker Compose configuration, and persistent volumes
- Backend: many API endpoints, admin seeding, moderation actions, and Prisma migrations
- Frontend: multiple pages, state management, UI polish, and accessibility improvements
- Realtime: WebSocket foundation, message delivery fixes, and read/receipt logic
- Testing & QA: unit/e2e tests, verification boards, and bug triage
- Documentation & process: README, meeting notes, Trello/Figma artifacts, and onboarding materials


### Challenges and solutions
- Synchronizing frontend and backend in a monorepo required careful environment configuration; Docker Compose helped stabilize the stack.
- OAuth and session management required secure secret handling; the `.env` file centralizes all required values.
- Real-time chat and moderation flows needed consistent state updates; Socket.IO and Redis were used for strong state support.

## Known limitations
- The current setup is optimized for local development and may need additional production hardening.
- Some advanced UI polish and accessibility improvements remain for future work.

## Additional notes
- For full database details, review `apps/backend/prisma/schema.prisma`.
- For backend-specific commands and tests, see `apps/backend/README.md`.
- For frontend-specific configuration, see `apps/frontend/README.md`.
