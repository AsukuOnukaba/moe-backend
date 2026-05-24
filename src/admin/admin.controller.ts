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
  listArtisans(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
  ) {
    return this.admin.listArtisans(
      Math.max(1, Number(page ?? 1)),
      Math.max(1, Math.min(100, Number(pageSize ?? 20))),
      status,
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
  listProducts(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
  ) {
    return this.admin.listProducts(
      Math.max(1, Number(page ?? 1)),
      Math.max(1, Math.min(100, Number(pageSize ?? 20))),
      status,
    );
  }

  @Get('products/:id')
  getProduct(@Param('id') id: string) {
    return this.admin.getProduct(Number(id));
  }

  @Patch('products/:id/status')
  patchProductStatus(
    @Param('id') id: string,
    @Body() body: { status: 'approved' | 'rejected' | 'draft'; reason?: string },
  ) {
    return this.admin.patchProductStatus(Number(id), body.status, body.reason);
  }

  @Get('users')
  listUsers(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('role') role?: string,
  ) {
    return this.admin.listUsers(
      Math.max(1, Number(page ?? 1)),
      Math.max(1, Math.min(100, Number(pageSize ?? 20))),
      role,
    );
  }

  @Get('users/:id')
  getUser(@Param('id') id: string) {
    return this.admin.getUser(Number(id));
  }

  @Get('orders')
  listOrders(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
    @Query('paymentStatus') paymentStatus?: string,
    @Query('q') q?: string,
  ) {
    return this.admin.listOrders({
      page,
      pageSize,
      status,
      paymentStatus,
      q,
    });
  }

  @Get('orders/:id')
  getOrder(@Param('id') id: string) {
    return this.admin.getOrder(Number(id));
  }

  @Patch('orders/:id')
  patchOrder(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.admin.patchOrder(Number(id), body);
  }
}
