import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Patch,
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
import { AuthService } from './auth.service';
import { AuthLoginDto } from './dto/auth-login.dto';
import { AuthRegisterDto } from './dto/auth-register.dto';
import { AuthRefreshDto } from './dto/auth-refresh.dto';
import { AuthProfilePatchDto } from './dto/auth-profile-patch.dto';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { AccessTokenPayload } from './types/jwt-payload';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  async register(@Body() dto: AuthRegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  async login(@Body() dto: AuthLoginDto) {
    return this.auth.login(dto);
  }

  @Post('refresh-token')
  async refresh(@Body() dto: AuthRefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async profile(@Req() req: Request) {
    const user = req.user as AccessTokenPayload | undefined;
    return this.auth.profile(user!.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  async patchProfile(@Req() req: Request, @Body() dto: AuthProfilePatchDto) {
    const user = req.user as AccessTokenPayload | undefined;
    return this.auth.patchProfile(user!.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('profile/avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multer.memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  )
  async uploadAvatar(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Missing file');
    }

    const ext = path.extname(file.originalname || '').toLowerCase() || '.png';
    const filename = `${randomUUID()}${ext}`;
    const uploadsDir = path.join(process.cwd(), 'uploads', 'avatars');
    await fs.mkdir(uploadsDir, { recursive: true });
    const filePath = path.join(uploadsDir, filename);
    await fs.writeFile(filePath, file.buffer);

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const avatarUrl = `${baseUrl}/uploads/avatars/${filename}`;
    return this.auth.setAvatar((req.user as AccessTokenPayload).sub, avatarUrl);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@Req() req: Request) {
    const user = req.user as AccessTokenPayload | undefined;
    return this.auth.logoutAll(user!.sub);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @Req() req: Request,
    @Body() dto: UpdateUserProfileDto,
  ) {
    const user = req.user as AccessTokenPayload | undefined;
    return this.auth.updateProfile(user!.sub, dto);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @Req() req: Request,
    @Body() dto: ChangePasswordDto,
  ) {
    const user = req.user as AccessTokenPayload | undefined;
    return this.auth.changePassword(user!.sub, dto);
  }
}

