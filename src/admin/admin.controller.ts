import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../auth/guards/admin-role.guard';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('dashboard')
  dashboard() {
    return this.admin.dashboard();
  }

  @Get('artisans')
  listArtisans(@Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.admin.listArtisans(
      Math.max(1, Number(page ?? 1)),
      Math.max(1, Math.min(100, Number(pageSize ?? 20))),
    );
  }

  @Get('artisans/:id')
  getArtisan(@Param('id') id: string) {
    return this.admin.getArtisan(Number(id));
  }

  @Patch('artisans/:id/status')
  patchArtisanStatus(
    @Param('id') id: string,
    @Body() body: { status: 'approved' | 'rejected'; reason?: string },
  ) {
    return this.admin.patchArtisanStatus(Number(id), body.status, body.reason);
  }

  @Get('products')
  listProducts(@Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.admin.listProducts(
      Math.max(1, Number(page ?? 1)),
      Math.max(1, Math.min(100, Number(pageSize ?? 20))),
    );
  }

  @Get('products/:id')
  getProduct(@Param('id') id: string) {
    return this.admin.getProduct(Number(id));
  }

  @Patch('products/:id/status')
  patchProductStatus(
    @Param('id') id: string,
    @Body() body: { status: 'approved' | 'rejected'; reason?: string },
  ) {
    return this.admin.patchProductStatus(Number(id), body.status, body.reason);
  }

  @Get('users')
  listUsers(@Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.admin.listUsers(
      Math.max(1, Number(page ?? 1)),
      Math.max(1, Math.min(100, Number(pageSize ?? 20))),
    );
  }

  @Get('users/:id')
  getUser(@Param('id') id: string) {
    return this.admin.getUser(Number(id));
  }
}
