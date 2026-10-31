import {
  BadRequestException,
  HttpCode,
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
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { AuthLoginDto } from './dto/auth-login.dto';
import { AuthRegisterDto } from './dto/auth-register.dto';
import { AuthRefreshDto } from './dto/auth-refresh.dto';
import { AuthClerkVerifyDto } from './dto/auth-clerk-verify.dto';
import { OAuthConsentDto } from './dto/oauth-consent.dto';
import { GoogleOauthGuard, googleUnavailableRedirect } from './guards/google-oauth.guard';
import { isGoogleOAuthConfigured } from './strategies/google.strategy';
import { issueOAuthConsentTicket } from './oauth-consent';
import { AuthProfilePatchDto } from './dto/auth-profile-patch.dto';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
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

  // The app-wide throttler guard already applies this route's @Throttle.
  // A second guard here counted each attempt twice and exhausted the
  // 3-per-hour limit on the second request.
  @Throttle({ default: { limit: 3, ttl: 3_600_000 } })
  @Post('register')
  async register(@Body() dto: AuthRegisterDto) {
    return this.auth.register(dto);
  }

  /** Flood ceiling only; failed-attempt lockout (5 failures → 5 min) lives in AuthService. */
  @UseGuards(MoeThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
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

  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('verify-email')
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.auth.verifyEmail(dto.token);
  }

  /** IP ceiling. Per-account 60s cooldown is enforced in AuthService without revealing whether the email exists. */
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  @Post('resend-verification')
  async resendVerification(@Body() dto: ResendVerificationDto) {
    return this.auth.resendVerification(dto.email);
  }

  @HttpCode(200)
  @Post('oauth-consent')
  oauthConsent(@Body() dto: OAuthConsentDto) {
    return issueOAuthConsentTicket(dto.acceptedTerms);
  }

  @Get('google')
  @UseGuards(GoogleOauthGuard)
  googleAuth(@Res() res: Response) {
    if (!isGoogleOAuthConfigured(this.config)) {
      return res.redirect(googleUnavailableRedirect(this.config));
    }
  }

  @Get('google/callback')
  @UseGuards(GoogleOauthGuard)
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    if (!isGoogleOAuthConfigured(this.config)) {
      return res.redirect(googleUnavailableRedirect(this.config));
    }
    const redirect =
      this.config.get<string>('GOOGLE_SUCCESS_REDIRECT') ??
      'http://localhost:8080/auth/callback';
    const consentState = typeof req.query.state === 'string' ? req.query.state : undefined;
    try {
      const result = await this.auth.handleGoogleLogin(req.user as any, consentState);
      const url = new URL(redirect);
      url.searchParams.set('token', result.token);
      url.searchParams.set('refreshToken', result.refreshToken);
      return res.redirect(url.toString());
    } catch (error) {
      if (error instanceof BadRequestException) {
        const signup = new URL('/auth', new URL(redirect).origin);
        signup.searchParams.set('tab', 'signup');
        signup.searchParams.set('error', 'consent');
        return res.redirect(signup.toString());
      }
      throw error;
    }
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
