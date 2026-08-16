// src/authentication/presentation/dto/discover.dto.ts

import { IsEmail }
from 'class-validator';

export class DiscoverDto {

  @IsEmail()
  email: string;
}