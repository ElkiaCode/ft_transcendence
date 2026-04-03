*File used throughout development to understand Next.js*

# Description of NestJS

Nest is a Node.js framework built around TypeScript, decorators, dependency injection, and a modular architecture.  
It is highly testable, scalable, loosely coupled, and maintainable, with an architecture strongly inspired by Angular.  
Nest gives a consistent way to organize code into **Modules**, **Controllers**, and **Providers/Services**.

Here is a summary of each feature of Nest:

- **Module** → groups related code for one feature
- **Controller** → is the HTTP entry point
- **Service/Provider** → contains reusable logic and can be injected
- **DTO** → defines the shape of incoming data and, with `ValidationPipe`, validates it
- **Guard** → decides whether the request may continue
- **Interceptor** → wraps execution before/after handler logic
- **Filter** → catches unhandled exceptions and formats errors
- **Middleware** → runs early, before the route handler pipeline

Let's use a simple request as an example:

**Route:** `POST /users`

```json
{
  "email": "alice@example.com",
  "name": "Alice",
  "password": "supersecret123",
  "role": "admin"
}
```

In NestJS, the request passes through this flow:

`middleware` → `guard` → `interceptor` (before) → `DTO validation / pipe` → `controller` → `service` → `interceptor` (after) → `response`

If something goes wrong along the way, an **exception filter** can shape the error response.

For the rest of this file, let's use this structure for examples:

```txt
src/
  app.module.ts
  main.ts

  users/
    users.module.ts
    users.controller.ts
    users.service.ts
    dto/
      create-user.dto.ts

  common/
    middleware/
      request-logger.middleware.ts
    guards/
      api-key.guard.ts
    interceptors/
      response-envelope.interceptor.ts
    filters/
      http-exception.filter.ts
```

## Modules = a feature container

A Nest module is a class decorated with `@Module()`. Nest uses its metadata to organize the application graph: which controllers exist, which providers exist, which modules import others, and which providers are exported.

Nest docs also stress that every app has at least one root module, and that feature modules are the normal way to organize growing applications.

Modules answer these questions when creating a feature:

- Which controllers belong to this feature?
- Which services/providers belong to it?
- Which other modules does it depend on?
- Which providers does it expose to other modules?

```ts
// users/users.module.ts
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

Here:

- `UsersController` becomes part of the users feature
- `UsersService` is created by Nest’s injector
- `exports: [UsersService]` means another module could import `UsersModule` and inject `UsersService`

## Controller = receives the HTTP request

**Controllers** are responsible for handling incoming requests and sending responses back to the client.  
Routing decorators such as `@Controller()`, `@Get()`, `@Post()`, `@Body()`, and `@Param()` are what let Nest build the routing map.

What a **controller** does:

- receives the request
- extracts route params, query params, body, and headers
- calls a service
- returns the result

```ts
// users/users.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { ResponseEnvelopeInterceptor } from '../common/interceptors/response-envelope.interceptor';

@Controller('users')
@UseGuards(ApiKeyGuard)
@UseInterceptors(ResponseEnvelopeInterceptor)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(Number(id));
  }

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }
}
```

Here:

- `@Controller('users')` means routes start with `/users`
- `@Get(':id')` maps `GET /users/:id`
- `@Post()` maps `POST /users`
- `@Param('id')` pulls a route parameter from `req.params`
- `@Body()` pulls the request body from `req.body`