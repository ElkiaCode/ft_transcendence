export type JwtPayload = {
  sub: string;
  email: string;
  username: string;
  role: 'USER' | 'MODERATOR' | 'ADMIN';
};