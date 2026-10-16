import { IsIn, IsString, MinLength } from 'class-validator';

export class RespondCustomOrderDto {
  @IsIn(['accept', 'decline'])
  action!: 'accept' | 'decline';

  @IsString()
  @MinLength(10, { message: 'Response must be at least 10 characters' })
  response!: string;
}
