*file used throughout development to understand nestJS*  

# What is NestJS ?  

NestJS is a framework Node.js based on 3 key idea.  

## 1. Modular architecture  

The app is divided into modules (e.g., UsersModule, AuthModule, GameModule, etc.).  
Each module groups together everything related to a specific domain.  

## 2. Dependency injection (DI)  

We almost never create new Service() ourself.  
Nest creates instances and automatically “injects” them using providers.  

## 3. Decorators (TypeScript syntax)  

You declare the role of classes with decorators: - @Module(): organizes  
                                                 - @Controller(): receives HTTP requests  
                                                 - @Injectable(): injectable service  
                                                 - @Get() @Post(): REST endpoints  

# 