*file used throughout development to understand Prisma*  

This file is only to undestand the current prisma shema in apps/backend/prisma/schema.prisma.  

# Introduction  

The `Prisma` schema is the blueprint of the database.  

Here are the major block of this shema:
- generator = “what code should Prisma create for me?”
- datasource = “what database am I using?”
- enum = “what fixed values are allowed?”
- model = “what tables do I have, and how are they linked?”

## Generator block

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
  moduleFormat = "cjs"
}
```

This tell `Prisma` to generate a `Prisma client`, which is the code the backend will use to talk to the database with function such as `prisma.user.create()`.
Prisma will generate file inside `../src/generated/prisma`

in conclusion this block generate the code I need to query my database, place it in this folder, and format it for CommonJS.

## datasource block

```prisma
datasource db {
  provider = "postgresql"
}
```

This tells Prisma that your database is `PostgreSQL`.

## Enum block

```prisma
enum GlobalRole {
  USER
  MODERATOR
  ADMIN
}
```

Simply a fixed list of allowed values.  
Prisma support enum as part of the data model.  

## Model block

A model is a table in the database.

example :
```prisma
model User {
  id       String @id @default(cuid())
  email    String @unique
  username String @unique
}
```

Here:
- `user` is a table
- each row is one user
- `id`, `email`, `username` are columns

Let's see a few key symbols :
- `@id` = this mark the primary key, it is the main identifier of the row so that mean every user has one unique id.  
- 

### User Model