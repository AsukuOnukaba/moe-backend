import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateDisputeDto {
  @IsInt()
  orderId!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  issueType!: string;

  @IsString()
  @MinLength(20)
  @MaxLength(5000)
  description!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUrl({}, { each: true })
  evidenceUrls?: string[];
}
