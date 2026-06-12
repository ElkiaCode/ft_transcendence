*DEV_DOC file used throughout development to explain step by step the project*    

# Project Goal  
  

## Current Modules chosen  

  
## Tech Stack  

1. Next.js (React framework) + Tailwindcss: ---> Frontend (pages/UI, call backend /api/...)  
2. NestJS:                                  ---> Backend (Websocket, auth, ...)  
3. PostgreSQL + prisma:                     ---> Persistent storage Database (users, matches, stats)  and prisma ORM for easier schema usage  
4. Minio:                                   ---> Upload*/manage files
5. Nginx + HTTPS:                           ---> Reverse Proxy and TLS certificate
6. Docker-compose + Makefile:               ---> Run in a single command

## Documentation  

[HTML](https://developer.mozilla.org/fr/docs/Web/HTML)  
[CSS](https://developer.mozilla.org/fr/docs/Web/CSS)  
[TypeScript](https://www.typescriptlang.org/docs/)  
[NEXT.JS](https://nextjs.org/docs/app/getting-started)  
[React](https://react.dev/learn)  
[TailwindCSS](https://v2.tailwindcss.com/docs/installation)  
[NestJS](https://docs.nestjs.com/)  
[Nginx](https://nginx.org/en/docs/)  
[PostgreSQL](https://www.postgresql.org/docs/current/)   
[Prisma](https://www.prisma.io/docs/getting-started/prisma-orm/quickstart/postgresql)  

Phase 1 — bootstrap the repo and infra  
  
Phase 2 — auth and user management  
email/password signup  
login  
JWT session flow  
refresh token flow  
profile page  
avatar upload  
user role system: admin / moderator / user  
42 OAuth login  

Phase 3 — social core  
user profiles  
friend requests  
friend list  
public/private groups  
memberships  
permissions inside groups  
create channels  

Phase 4 — basic chat first  
send message  
receive message  
persist messages  
direct messages  
group channel messages
