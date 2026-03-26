import { Body, Controller, Delete, Get, Patch, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';
import { PreferencesService } from './preferences.service';

@Controller('customers/me/preferences')
export class PreferencesController {
  constructor(private readonly prefs: PreferencesService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  get(@Req() req: Request) {
    const user = req.user as AccessTokenPayload;
    return this.prefs.get(user);
  }

  // Spec says POST to create/update; keep idempotent.
  @UseGuards(JwtAuthGuard)
  @Patch()
  upsert(@Req() req: Request, @Body() body: any) {
    const user = req.user as AccessTokenPayload;
    return this.prefs.upsert(user, body);
  }

  @UseGuards(JwtAuthGuard)
  @Delete()
  clear(@Req() req: Request) {
    const user = req.user as AccessTokenPayload;
    return this.prefs.clear(user);
  }
}

