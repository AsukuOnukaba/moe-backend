import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../auth/guards/admin-role.guard';
import { EventsService } from './events.service';

@Controller('admin/events')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminEventsController {
  constructor(private readonly events: EventsService) {}

  @Get('summary')
  summary() {
    return this.events.adminSummary();
  }
}
