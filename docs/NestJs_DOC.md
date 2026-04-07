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

## Interceptor = Wraps execution before/after handler logic  

`Interceptor` are class implemeting `NestInterceptor`.  
They can bind logic before/after method execution transform returned results, transform exceptions, extend behavior, and even fully override execution, such as for caching.  
They receive `ExecutionContext` and `CallHandler`, and if `handle()` is never called, the route handler never runs.  

They are perfect for :
- timing request  
- logging duration  
- wrapping all reponse in a common shape  
- serialization 
- catching  
- mapping null values
- retry/timeout pattern

Example :  
```ts
// common/interceptors/response-envelope.interceptor.ts
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

@Injectable()
export class ResponseEnvelopeInterceptor
  implements NestInterceptor
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const startedAt = Date.now();

    return next.handle().pipe(
      map((data) => ({
        data,
        meta: {
          path: request.url,
          durationMs: Date.now() - startedAt,
        },
      })),
    );
  }
}
```

Here, if the controller return :
```json
{
  "id": 1,
  "email": "alice@example.com"
}
```

The Interceptor can transform it to :  
```json
{
  "data": {
    "id": 1,
    "email": "alice@example.com"
  },
  "meta": {
    "path": "/api/users",
    "durationMs": 4
  }
}
```

Binding `Interceptor` : they can be method, controller, or global scoped with `@UseInterceptors()` or `useGlobalInterceptors()`  

```ts
@Controller('users')
@UseInterceptors(ResponseEnvelopeInterceptor)
export class UsersController {}
```

## Filter = format unhandled errors  

It's the Nest built-in execption layer that process unhandled exception across the application.  
`HttpException` and its subclasses are handled by the built-in global exception filter, and unknown exceptions default to a `500 Internal server error response`. Custom exception filters let you take control of how errors are returned.   

A Filter is for reponse shaping.  

Typical uses :  
- always return a custom Json Format  
- include `timestamp` and `path`  
- hide internal details  
- standardize errors across the backend  

Example :  
```ts
// common/filters/http-exception.filter.ts
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.message
        : 'Internal server error';

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
```

Let's suppose that `UserServices.create()` Throws :  
```ts
throw new ConflictException('Email already exists');  
```

Without a custom filter, Nest’s built-in exception layer already sends a valid HTTP error response.
With a custom  filter, i can shape it consistently for the frontend. Nest docs show a custom `HttpExceptionFilter` that adds fields like `statusCode`, `timestamp`, and `path`.  

## Middleware = runs early in the request pipeline  

`Middleware` is a function called before the route handler, with access to request, response and `next()`.  
They are equivalent by default to Express middleware when using the Express adapter, and they are configured with `configure()` in a module, not inside the `@Module()` metadata.  

They are good for :  
- request logging  
- attaching request id  
- parsing or enriching data request  
- reading raw header  
- setting up per request context  

## Let's put them all together  

We will take for example the flow of `POST /api/users`.  

### Step 1: Middleware run  

`RequestLoggerMiddleware` runs first

it might :  
- generate a request ID  
- log POST /api/users
- attach `requestID` to `req`  

this happend before guard and validation  

### Step 2: Guard Run  

`ApiKeyGuard` checks `x-api-key`.  
- if invalid: throws `UnauthorizedException`  
- if valid: returns `true` and Nest continues  

Guards run after middleware and before interceptors/pipes.  

### Step 3: Interceptor start wrapping execution  

ResponseEnvelopeInterceptor begins its `intercept()` method.  

It can record start time before calling `next.handle()`. Nest docs explain that `handle()` invokes the route handler stream, and not calling it means the handler never executes.  

### Step 4: DTO validation happens  

`ValidationPipe` checks the `CreateUserDto` rules:  
- `email` must be a valid email
- `name` must be a string of at least length 2
- `password` must be at least length 8
- `role` must be `user` or `admin` if present

If invalid, an exception is thrown. Nest docs recommend validation of incoming data and document how `ValidationPipe` uses DTO classes.  

### Step 5: Controller receives the validated body  

The controller finally runs :
```ts
@Post()
create(@Body() dto: CreateUserDto) {
  return this.usersService.create(dto);
}
```

The controller’s job here is tiny by design. It just hands off to the service. That matches Nest’s recommended split of responsibilities.  

### Step 6: Service performs business logic  

`UsersService.create(dto)`:  
- checks duplicate email
- hashes password
- stores the user
- returns the created object

If email exists, it throws `ConflictException`.  

### Step 7: Interceptor transforms the result  

The interceptor receives the returned value and wraps it:
```json
{
  "data": {
    "id": 1,
    "email": "alice@example.com",
    "name": "Alice",
    "passwordHash": "hashed:supersecret123",
    "role": "admin"
  },
  "meta": {
    "path": "/api/users",
    "durationMs": 5
  }
}
```

### Step 8: If anything threw, the filter formats the error  

If the guard failed, or validation failed, or the service threw a `ConflictException`, the filter shapes the final error JSON.  

That is the job of exception filters.  

## The shortest possible memory aid

For one incoming request:

1. Middleware: “A request arrived.”  
2. Guard: “Is this allowed?”  
3. Pipe/DTO validation: “Is this input valid?”  
4. Controller: “Which service method should I call?”  
5. Service: “Do the real work.”  
6. Interceptor: “Wrap/transform the result.”  
7. Filter: “If something failed, shape the error.”  