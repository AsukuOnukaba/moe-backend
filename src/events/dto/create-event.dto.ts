import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export const EVENT_TYPES = [
  'page_view',
  'product_view',
  'artisan_view',
  'search',
  'filter_applied',
  'wishlist_add',
  'add_to_cart',
  'category_browse',
] as const;

export class CreateEventDto {
  @IsString()
  @MaxLength(128)
  sessionId!: string;

  @IsIn(EVENT_TYPES as unknown as string[])
  eventType!: (typeof EVENT_TYPES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(64)
  entityType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  entityId?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsObject()
  metadata?: Record<string, unknown>;
}
