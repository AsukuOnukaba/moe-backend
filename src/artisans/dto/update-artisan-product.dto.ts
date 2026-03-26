import { PartialType } from '@nestjs/mapped-types';
import { CreateArtisanProductDto } from './create-artisan-product.dto';

export class UpdateArtisanProductDto extends PartialType(CreateArtisanProductDto) {}

