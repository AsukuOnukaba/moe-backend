import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';
import { ArtisanReviewsService } from './artisan-reviews.service';
import { ArtisanVerificationService } from './artisan-verification.service';
import { ArtisansService } from './artisans.service';
import { UpdateArtisanProfileDto } from './dto/update-artisan-profile.dto';
import { CreateArtisanProductDto } from './dto/create-artisan-product.dto';
import { UpdateArtisanProductDto } from './dto/update-artisan-product.dto';
import { cloudinaryUrl, createMulterOptions } from '../upload/multer.config';

@Controller('artisans')
export class ArtisansController {
  constructor(
    private readonly artisans: ArtisansService,
    private readonly reviews: ArtisanReviewsService,
    private readonly verification: ArtisanVerificationService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('verification/documents')
  listMyVerificationDocuments(@Req() req: Request) {
    return this.verification.listMine(req.user as AccessTokenPayload);
  }

  @UseGuards(JwtAuthGuard)
  @Post('verification/documents')
  @UseInterceptors(FileInterceptor('file', createMulterOptions('verification')))
  async uploadVerificationDocument(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { fileType?: string; type?: string },
  ) {
    const user = req.user as AccessTokenPayload;
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    const fileType = (body?.fileType ?? body?.type)?.trim();
    if (!fileType) {
      throw new BadRequestException('fileType is required');
    }
    return this.verification.uploadDocument(
      user,
      fileType,
      cloudinaryUrl(file),
    );
  }

  @Get('filter-meta')
  filterMeta() {
    return this.artisans.getFilterMeta();
  }

  @Get(':id/rush-order-config')
  rushOrderConfig(@Param('id') id: string) {
    return this.artisans.getRushOrderConfig(Number(id));
  }

  @Get(':id/reviews')
  listReviews(@Param('id') id: string, @Query() query: Record<string, string>) {
    return this.reviews.list(Number(id), {
      page: query.page ? Number(query.page) : undefined,
      pageSize: query.pageSize ? Number(query.pageSize) : undefined,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/reviews')
  upsertReview(
    @Param('id') id: string,
    @Req() req: Request,
    @Body() body: { rating?: number; comment?: string },
  ) {
    const user = req.user as AccessTokenPayload;
    return this.reviews.upsert(Number(id), user, body);
  }

  @Get()
  async getAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('category') category?: string,
    @Query('country') country?: string,
    @Query('state') state?: string,
    @Query('city') city?: string,
  ) {
    const pageNum = page ? Number(page) : 1;
    const sizeNum = pageSize ? Number(pageSize) : 20;
    return this.artisans.getAll(pageNum, sizeNum, {
      category: category?.trim() || undefined,
      country: country?.trim() || undefined,
      state: state?.trim() || undefined,
      city: city?.trim() || undefined,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@Req() req: Request) {
    const user = req.user as AccessTokenPayload | undefined;
    return this.artisans.getMe(user!);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  async patchMe(@Req() req: Request, @Body() dto: UpdateArtisanProfileDto) {
    const user = req.user as AccessTokenPayload | undefined;
    return this.artisans.patchMe(user!, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/products')
  async listProducts(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const user = req.user as AccessTokenPayload | undefined;
    const pageNum = page ? Number(page) : 1;
    const sizeNum = pageSize ? Number(pageSize) : 20;
    return this.artisans.listProducts(user!, pageNum, sizeNum);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/products')
  async createProduct(@Req() req: Request, @Body() dto: CreateArtisanProductDto) {
    const user = req.user as AccessTokenPayload | undefined;
    return this.artisans.createProduct(user!, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/products/upload-image')
  @UseInterceptors(FileInterceptor('file', createMulterOptions('products')))
  async uploadProductImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return { url: cloudinaryUrl(file) };
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/upload-image')
  @UseInterceptors(FileInterceptor('file', createMulterOptions('store')))
  async uploadStoreImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return { url: cloudinaryUrl(file) };
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/upload-cover')
  @UseInterceptors(FileInterceptor('file', createMulterOptions('covers')))
  async uploadCoverImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return { url: cloudinaryUrl(file) };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/products/:id')
  async patchProduct(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateArtisanProductDto,
  ) {
    const user = req.user as AccessTokenPayload | undefined;
    return this.artisans.patchProduct(user!, Number(id), dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('me/products/:id')
  async deleteProduct(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as AccessTokenPayload | undefined;
    return this.artisans.deleteProduct(user!, Number(id));
  }

  /** Public products for an artisan — same filter as productCount on listing/detail. */
  @Get(':id/products')
  async listPublicProducts(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.artisans.listPublicProducts(
      Number(id),
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 20,
    );
  }

  /** Public artisan detail (approved only). */
  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.artisans.getById(Number(id));
  }
}
