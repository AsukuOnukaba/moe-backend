import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { DisputesService } from './disputes.service';

@Controller('disputes')
export class DisputesController {
  constructor(private readonly disputes: DisputesService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Req() req: Request, @Body() dto: CreateDisputeDto) {
    const user = req.user as AccessTokenPayload;
    return this.disputes.create(user, dto);
  }
}
