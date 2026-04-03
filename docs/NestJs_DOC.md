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

## Service / Provider = contain buisness logic  

Services, repositories, helpers, and factories can all be providers. The key idea is that providers can be injected as dependencies, and Nest handles the wiring. Controllers should delegate complex tasks to providers.  

`Provider` vs `Service` :

- `Provider` is the broad Nest term.  
- `Service` is the common naming convention for a profider containing buisnnes logic.  

So every service is usually a provider, but not every provider is necessarily called a service.  

exemple :
```ts
// users/users.service.ts
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';

type User = {
  id: number;
  email: string;
  name: string;
  passwordHash: string;
  role: 'user' | 'admin';
};

@Injectable()
export class UsersService {
  private users: User[] = [];
  private nextId = 1;

  findOne(id: number) {
    const user = this.users.find((u) => u.id === id);

    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    return user;
  }

  create(dto: CreateUserDto) {
    const existing = this.users.find((u) => u.email === dto.email);

    if (existing) {
      throw new ConflictException('Email already exists');
    }

    const user: User = {
      id: this.nextId++,
      email: dto.email,
      name: dto.name,
      passwordHash: `hashed:${dto.password}`,
      role: dto.role ?? 'user',
    };

    this.users.push(user);
    return user;
  }
}
```

Here are the service rules :  

- Email must be unique.  
- Password must be hashed.  
- throw 404 if user not found.  

### `@Injectable()` purpose  

Provider are injectable dependencies and are managed by Nest's runtime system.  
`@Injectable()` marks the class so Nest can create amd inject it where needed.  

```ts
constructor(private readonly usersService: UsersService) {}  
```

Nest see this constructor parameter, look in the current module for a provider matching `UsersService` create it if needed and inject it.  


## DTO = describe and validate incoming data  

A `DTO` is usually just a class that describes the expected input shape.  
Nest’s controller docs show `DTO` classes used with `@Body()`, and that `ValidationPipe` and `class-transformer` so validation rules can be declared in DTO classes.  

A `DTO` answer :
- What fields are allowed ?  
- whitch fields are required ?  
- what type each fields should be ?  
- what constrain apply ?  

Example :  
``` ts
// users/dto/create-user.dto.ts
import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsOptional()
  @IsIn(['user', 'admin'])
  role?: 'user' | 'admin';
}
```

But this is not enough, we also need `ValidationPipe` to enforce validation rules for incoming payload declared via DTO annotation.  

If we enable validation gloabally :
```ts
// main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  await app.listen(3000);
}
bootstrap();
```

Here :
- `whitelist: true` strips properties not decorated in the validation class
- `forbidNonWhitelisted: true` throws instead of silently allowing extra properties
- `transform: true` transforms payloads into DTO-typed objects automatically

so if the client send :
```json
{
  "email": "alice@example.com",
  "name": "Alice",
  "password": "supersecret123",
  "role": "admin",
  "isSuperUser": true
}
```

then :
- `with whitelist: true`, isSuperUser is removed
- `with forbidNonWhitelisted: true`, the request is rejected instead
- `with transform: true`, Nest converts the plain payload into the DTO class form

## Guard = decide whether the request is allowed  

`Guards` have a single responsibility: determine whether a request will be handled by the route handler, depending on runtime conditions such as permissions or roles.  

Typical uses:
- is the user authenticated?
- does the token exist?
- does the user have the required role?
- is this API key valid?

Exemple of of an API guard :  
```ts
// common/guards/api-key.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];

    if (apiKey !== 'my-secret-key') {
      throw new UnauthorizedException('Invalid API key');
    }

    return true;
  }
}
```

If the condition fail the should should not RUN !

