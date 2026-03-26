import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';
import { ArtisansService } from './artisans.service';
import { UpdateArtisanProfileDto } from './dto/update-artisan-profile.dto';
import { CreateArtisanProductDto } from './dto/create-artisan-product.dto';
import { UpdateArtisanProductDto } from './dto/update-artisan-product.dto';

@Controller('artisans')
export class ArtisansController {
  constructor(private readonly artisans: ArtisansService) {}

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

