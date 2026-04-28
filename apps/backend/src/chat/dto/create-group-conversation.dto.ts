import { ArrayMinSize, ArrayUnique, IsArray, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateGroupConversationDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayUnique()
  @IsString({ each: true })
  userIds: string[];
}