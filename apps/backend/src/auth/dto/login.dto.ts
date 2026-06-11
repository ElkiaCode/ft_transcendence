import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'marvin@42.fr',
    description: 'The email of the user',
  })
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({
    example: 'password123',
    description: 'The user password',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;
}
