import { AuthService } from '@/auth/auth.service';
import { RegisterDto } from '@/auth/dto/register.dto';
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';

@Injectable()
export class UsersBootstrapDev implements OnApplicationBootstrap {
  private static readonly testUsers: RegisterDto[] = [
    { email: 'user1@test.com', username: 'user1', password: 'password1' },
    { email: 'user2@test.com', username: 'user2', password: 'password2' },
    { email: 'user3@test.com', username: 'user3', password: 'password3' },
    { email: 'user4@test.com', username: 'user4', password: 'password4' },
    { email: 'user5@test.com', username: 'user5', password: 'password5' },
    { email: 'user6@test.com', username: 'user6', password: 'password6' },
    { email: 'user7@test.com', username: 'user7', password: 'password7' },
    { email: 'user8@test.com', username: 'user8', password: 'password8' },
    { email: 'user9@test.com', username: 'user9', password: 'password9' },
    { email: 'user10@test.com', username: 'user10', password: 'password10' },
  ];

  constructor(private readonly authSvc: AuthService) {}

  async onApplicationBootstrap() {
    for (const user of UsersBootstrapDev.testUsers) {
      try {
        await this.authSvc.login({
          email: user.email,
          password: user.password,
        });
        await this.authSvc.register(user);
      } catch {}
    }
  }
}
