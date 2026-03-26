import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { AuthLoginDto } from './dto/auth-login.dto';
import { AuthRegisterDto } from './dto/auth-register.dto';
import { AuthRefreshDto } from './dto/auth-refresh.dto';
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
  @Post('logout')
  async logout(@Req() req: Request) {
    const user = req.user as AccessTokenPayload | undefined;
    return this.auth.logoutAll(user!.sub);
  }
}

