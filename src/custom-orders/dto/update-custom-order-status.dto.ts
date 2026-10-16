import { IsIn } from 'class-validator';

export class UpdateCustomOrderStatusDto {
  @IsIn(['in_progress', 'completed', 'cancelled'])
  status!: 'in_progress' | 'completed' | 'cancelled';
}
