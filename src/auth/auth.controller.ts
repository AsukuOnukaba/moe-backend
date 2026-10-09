import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { AuthLoginDto } from './dto/auth-login.dto';
import { AuthRegisterDto } from './dto/auth-register.dto';
import { AuthRefreshDto } from './dto/auth-refresh.dto';
import { AuthClerkVerifyDto } from './dto/auth-clerk-verify.dto';
import { AuthProfilePatchDto } from './dto/auth-profile-patch.dto';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { MoeThrottlerGuard } from '../common/guards/moe-throttler.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { AccessTokenPayload } from './types/jwt-payload';
import { ConfigService } from '@nestjs/config';
import { cloudinaryUrl, createMulterOptions } from '../upload/multer.config';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @UseGuards(MoeThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  async register(@Body() dto: AuthRegisterDto) {
    return this.auth.register(dto);
  }

  @UseGuards(MoeThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  async login(@Body() dto: AuthLoginDto) {
    return this.auth.login(dto);
  }

  @UseGuards(MoeThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 300_000 } })
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto.email);
  }

  @Get('reset-password')
  async validateResetToken(@Query('token') token?: string) {
    if (!token?.trim()) {
      throw new BadRequestException('Reset token is required');
    }
    return this.auth.validateResetToken(token.trim());
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPasswordWithToken(dto.token, dto.newPassword);
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

  /** Exchange a Clerk session token for MOE access/refresh tokens. */
  @Post('clerk-verify')
  async clerkVerify(@Body() dto: AuthClerkVerifyDto) {
    return this.auth.handleClerkLogin(dto.token);
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
  @UseInterceptors(FileInterceptor('file', createMulterOptions('avatars')))
  async uploadAvatar(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    const url = cloudinaryUrl(file);
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

  @Patch('change-password')
  @UseGuards(JwtAuthGuard)
  async changePassword(@Req() req: Request, @Body() dto: ChangePasswordDto) {
    const user = req.user as AccessTokenPayload | undefined;
    return this.auth.changePassword(user!.sub, dto);
  }

  /** @deprecated Use PATCH /auth/change-password */
  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  async changePasswordLegacy(@Req() req: Request, @Body() dto: ChangePasswordDto) {
    const user = req.user as AccessTokenPayload | undefined;
    return this.auth.changePassword(user!.sub, dto);
  }
}
