import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
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
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { AdminVerifyOtpDto } from './dto/admin-verify-otp.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { AccessTokenPayload } from './types/jwt-payload';
import { CloudinaryService } from '../common/storage/cloudinary.service';
import { ConfigService } from '@nestjs/config';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly cloudinary: CloudinaryService,
    private readonly config: ConfigService,
  ) {}

  @Post('register')
  async register(@Body() dto: AuthRegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  async login(@Body() dto: AuthLoginDto) {
    return this.auth.login(dto);
  }

  @Post('verify-email')
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.auth.verifyEmail(dto.email, dto.otp);
  }

  @Post('resend-otp')
  resendOtp(@Body() dto: ResendOtpDto) {
    return this.auth.resendOtp(dto.email);
  }

  @Post('admin/verify-otp')
  verifyAdminOtp(@Body() dto: AdminVerifyOtpDto) {
    return this.auth.verifyAdminOtp(dto.email, dto.otp);
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth() {
    return;
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const result = await this.auth.handleGoogleLogin(req.user as any);
    const redirect =
      this.config.get<string>('GOOGLE_SUCCESS_REDIRECT') ??
      'http://localhost:8080/auth/google/callback';
    const url = new URL(redirect);
    url.searchParams.set('token', result.token);
    url.searchParams.set('refreshToken', result.refreshToken);
    return res.redirect(url.toString());
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
      limits: { fileSize: 10 * 1024 * 1024 },
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
    const url = await this.cloudinary.uploadBuffer(file.buffer, 'avatars', filename);
    await this.auth.setAvatar((req.user as AccessTokenPayload).sub, url);
    return { url };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@Req() req: Request) {
    const user = req.user as AccessTokenPayload | undefined;
    return this.auth.logoutAll(user!.sub);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(@Req() req: Request, @Body() dto: UpdateUserProfileDto) {
    const user = req.user as AccessTokenPayload | undefined;
    return this.auth.updateProfile(user!.sub, dto);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  async changePassword(@Req() req: Request, @Body() dto: ChangePasswordDto) {
    const user = req.user as AccessTokenPayload | undefined;
    return this.auth.changePassword(user!.sub, dto);
  }
}
