import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(2, { message: 'O nome precisa ter ao menos 2 caracteres.' })
  name!: string;

  @IsEmail({}, { message: 'E-mail invalido.' })
  email!: string;

  @IsString()
  @MinLength(8, { message: 'A senha precisa ter ao menos 8 caracteres.' })
  password!: string;
}

export class LoginDto {
  @IsEmail({}, { message: 'E-mail invalido.' })
  email!: string;

  @IsString()
  password!: string;
}
