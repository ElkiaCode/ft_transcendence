import { ArrayMinSize, ArrayUnique, IsArray, IsString } from 'class-validator';

export class InviteUsersDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsString({ each: true })
  userIds!: string[];
}
