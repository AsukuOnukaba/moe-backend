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
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import multer from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';
import { ArtisansService } from './artisans.service';
import { UpdateArtisanProfileDto } from './dto/update-artisan-profile.dto';
import { CreateArtisanProductDto } from './dto/create-artisan-product.dto';
import { UpdateArtisanProductDto } from './dto/update-artisan-product.dto';

@Controller('artisans')
export class ArtisansController {
  constructor(private readonly artisans: ArtisansService) {}

  @Get()
  async getAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('category') category?: string,
  ) {
    const pageNum = page ? Number(page) : 1;
    const sizeNum = pageSize ? Number(pageSize) : 20;
    return this.artisans.getAll(pageNum, sizeNum, category);
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
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multer.memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  )
  async uploadProductImage(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Missing file');
    }

    const ext = path.extname(file.originalname || '').toLowerCase() || '.png';
    const filename = `${randomUUID()}${ext}`;
    const uploadsDir = path.join(process.cwd(), 'uploads', 'products');
    await fs.mkdir(uploadsDir, { recursive: true });
    const filePath = path.join(uploadsDir, filename);
    await fs.writeFile(filePath, file.buffer);

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const imageUrl = `${baseUrl}/uploads/products/${filename}`;
    return { imageUrl };
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/upload-image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multer.memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
      fileFilter: (req, file, callback) => {
        const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedMimes.includes(file.mimetype)) {
          callback(
            new BadRequestException({
              message: 'Unsupported file type. Upload a JPEG, PNG, or WebP image.',
            }),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  async uploadProfileImage(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException({ message: 'No file provided' });
    }

    const ext = path.extname(file.originalname || '').toLowerCase() || '.png';
    const filename = `${randomUUID()}${ext}`;
    const uploadsDir = path.join(process.cwd(), 'uploads', 'artisans');
    await fs.mkdir(uploadsDir, { recursive: true });
    const filePath = path.join(uploadsDir, filename);
    await fs.writeFile(filePath, file.buffer);

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const url = `${baseUrl}/uploads/artisans/${filename}`;
    return { url };
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/upload-cover')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multer.memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
      fileFilter: (req, file, callback) => {
        const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedMimes.includes(file.mimetype)) {
          callback(
            new BadRequestException({
              message: 'Unsupported file type. Upload a JPEG, PNG, or WebP image.',
            }),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  async uploadCoverImage(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException({ message: 'No file provided' });
    }

    const ext = path.extname(file.originalname || '').toLowerCase() || '.png';
    const filename = `${randomUUID()}${ext}`;
    const uploadsDir = path.join(process.cwd(), 'uploads', 'artisans');
    await fs.mkdir(uploadsDir, { recursive: true });
    const filePath = path.join(uploadsDir, filename);
    await fs.writeFile(filePath, file.buffer);

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const url = `${baseUrl}/uploads/artisans/${filename}`;
    return { url };
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
}

