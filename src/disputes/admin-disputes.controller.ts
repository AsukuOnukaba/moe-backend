import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../auth/guards/admin-role.guard';
import { DisputesService } from './disputes.service';
import { ListAdminDisputesQueryDto } from './dto/list-admin-disputes-query.dto';
import { UpdateDisputeDto } from './dto/update-dispute.dto';

@Controller('admin/disputes')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminDisputesController {
  constructor(private readonly disputes: DisputesService) {}

  @Get()
  list(@Query() query: ListAdminDisputesQueryDto) {
    return this.disputes.listForAdmin(query);
  }

  @Patch(':id')
  patch(@Param('id') id: string, @Body() dto: UpdateDisputeDto) {
    return this.disputes.patchForAdmin(id, dto);
  }
}
