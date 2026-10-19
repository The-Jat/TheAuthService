import { IsEmail, IsObject, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class SignupDto {
  @Transform(trim) @IsEmail({}, { message: 'Enter a valid email address.' }) @MaxLength(254)
  email: string;

  @Transform(trim) @IsString() @Length(1, 80, { message: 'Name must be 1–80 characters.' })
  name: string;

  @IsString() @MaxLength(256)
  password: string;
}

export class LoginDto {
  @Transform(trim) @IsEmail({}, { message: 'Enter a valid email address.' }) @MaxLength(254)
  email: string;

  @IsString() @MaxLength(256)
  password: string;
}

export class EmailDto {
  @Transform(trim) @IsEmail({}, { message: 'Enter a valid email address.' }) @MaxLength(254)
  email: string;
}

export class TokenDto {
  @IsString() @Length(10, 100)
  token: string;
}

export class ResetPasswordDto extends TokenDto {
  @IsString() @MaxLength(256)
  password: string;
}

export class PasskeyResponseDto {
  @IsObject()
  response: any;

  @IsOptional() @IsString() @MaxLength(60)
  name?: string;
}
