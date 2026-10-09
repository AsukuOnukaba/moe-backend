import { IsIn, IsOptional, IsString } from 'class-validator';

const DISPUTE_STATUSES = [
  'open',
  'under_review',
  'resolved',
  'closed',
] as const;

export class ListAdminDisputesQueryDto {
  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  pageSize?: string;

  @IsOptional()
  @IsIn([...DISPUTE_STATUSES])
  status?: (typeof DISPUTE_STATUSES)[number];
}
