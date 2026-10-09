import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const DISPUTE_STATUSES = [
  'open',
  'under_review',
  'resolved',
  'closed',
] as const;

export class UpdateDisputeDto {
  @IsOptional()
  @IsIn([...DISPUTE_STATUSES])
  status?: (typeof DISPUTE_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  resolution?: string;
}
