export class ProfileResponseDto {
  id: string;
  displayName: string;
  bio?: string | null;
  avatarUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
