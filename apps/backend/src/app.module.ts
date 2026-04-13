import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health/health.controller';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { AdminModule } from './admin/admin.module';
import { ConfigModule } from '@nestjs/config';
import { RelationshipsModule } from './relationships/relationships.module';

@Module({
  imports: [
    PrismaModule,
    RelationshipsModule,
    AuthModule,
    UsersModule,
    AdminModule,
    ConfigModule.forRoot({ isGlobal: true})
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}