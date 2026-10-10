import { IsIn, IsOptional, IsString } from 'class-validator';

export class RespondCustomOrderDto {
  @IsIn(['accepted', 'declined'])
  status!: 'accepted' | 'declined';

  @IsOptional()
  @IsString()
  artisanResponse?: string;
}
