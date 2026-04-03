*file used throughout development to understand nextJS*  

# Description of NestJs  

Nest is a Node.js framework built around TypeScript, decorators, dependency injection, and a modular architecture.  
It's as highly testable, scalable, loosely coupled, and maintainable, with an architecture strongly inspired by Angular.  
Nest gives a consistent way to organize code into ***Modules***, ***Controllers*** and ***Providers/Services***.  

Here is a summarize of each feature of Nest : - Module              ---> groups related code for one feature.  
                                              - Controller          ---> is the HTTP entry point.  
                                              - Service/Provider    ---> contain reusable logic and can be injected.  
                                              - DTO                 ---> define the shape of incoming data and, with *ValidationPipe*, validate it.
                                              - Guard               ---> decide whether the request may continue.  
                                              - Interceptor         ---> wrap execution before/after handler logic.  
                                              - Filter              ---> catch unhandled exeception and format error.  
                                              - Middleware          ---> runs early, before the route handler pipeline.  

Let's us a simple request, the example route ---> POST /users

<pre>
The client send :  
{  
  "email": "alice@example.com",  
  "name": "Alice",  
  "password": "supersecret123",  
  "role": "admin"  
}  
</pre>

In NestJs the request pass through this flow : *middleware* -> *guard* -> *interceptor* (before) -> *DTO validation/pipe* -> *controller* -> *service* -> *interceptor* (after) -> response and if something go wrong along the way an *exeception filter* can shape the error response.  

For the rest of this file let's use this structure for example :  

<pre>  
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
</pre>

## Modules = a feature conatiner

A Nest module is a class decorated with *@Module()*. Nest uses its metadata to organize the application graph: which controllers exist, which providers exist, which modules import others, and which providers are exported. Nest docs also stress that every app has at least one root module, and that feature modules are the normal way to organize growing applications.

Modules are able to answer those question when creating a feature : - Which controllers belong to this feature ?  
                                                                    - Which services/providers belong to it ?  
                                                                    - Which other modules does it depend on ?  
                                                                    - Which providers does it expose to other modules ?  

<pre>
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
</pre>

Here :  UsersController becomes part of the users feature.  
        UsersService is created by Nest’s injector.  
        exports: [UsersService] means another module could import UsersModule and inject UsersService.  

## Controller = receive the HTTP request  

*Controllers* are responsible for handling incoming requests and sending responses back to the client. Routing decorators such as @Controller(), @Get(), @Post(), @Body(), and @Param() are what let Nest build the routing map.  

What *controller* do : - receive the request  
                       - extract route params, query params, body, headers  
                       - call a service  
                       - return the result  

<pre>  
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
</pre>

Here :  @Controller('users') means routes start with /users.  
        @Get(':id') maps GET /users/:id.  
        @Post() maps POST /users.  
        @Param('id') pulls a route parameter from req.params.  
        @Body() pulls the request body from req.body. Nest documents these parameter decorators directly.  

