import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../auth/guards/admin-role.guard';
import { AdminService } from './admin.service';
import { ConversationsService } from '../messaging/conversations.service';
import { CategoriesService } from '../categories/categories.service';
import { CreateCategoryDto } from '../categories/dto/create-category.dto';
import { UpdateCategoryDto } from '../categories/dto/update-category.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly conversations: ConversationsService,
    private readonly categories: CategoriesService,
  ) {}

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

  @Delete('products/:id')
  @HttpCode(204)
  async removeProduct(
    @Req() req: Request,
    @Param('id') id: string,
    @Query('reason') reason?: string,
  ) {
    const user = req.user as AccessTokenPayload;
    await this.admin.removeProduct(Number(id), user.sub, reason);
  }

  @Get('users')
  listUsers(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
  ) {
    return this.admin.listUsers(
      Math.max(1, Number(page ?? 1)),
      Math.max(1, Math.min(100, Number(pageSize ?? 20))),
      role,
      status,
    );
  }

  @Get('users/:id')
  getUser(@Param('id') id: string) {
    return this.admin.getUser(Number(id));
  }

  @Post('users')
  createUser(
    @Body()
    body: {
      name: string;
      email: string;
      phone?: string;
      role: 'customer' | 'artisan' | 'admin';
      temporaryPassword: string;
      businessName?: string;
      category?: string;
    },
  ) {
    return this.admin.createUser(body);
  }

  @Post('users/:id/reset-password')
  resetUserPassword(@Param('id') id: string) {
    return this.admin.resetUserPassword(Number(id));
  }

  @Patch('users/:id/status')
  patchUserStatus(
    @Param('id') id: string,
    @Body() body: { status: 'active' | 'suspended' },
  ) {
    return this.admin.patchUserStatus(Number(id), body.status);
  }

  @Delete('users/:id')
  @HttpCode(200)
  deleteUser(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as AccessTokenPayload;
    return this.admin.deleteUser(Number(id), user.sub);
  }

  @Get('conversations')
  listConversations(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
  ) {
    return this.conversations.listForAdmin({
      page: Number(page ?? 1),
      pageSize: Number(pageSize ?? 20),
      status,
    });
  }

  @Get('conversations/:id')
  getConversation(@Param('id') id: string) {
    return this.conversations.getMessagesForAdmin(Number(id));
  }

  @Post('conversations/:id/reply')
  adminReply(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { content: string },
  ) {
    const user = req.user as AccessTokenPayload;
    return this.conversations.adminReply(user, Number(id), body);
  }

  @Patch('conversations/:id/status')
  patchConversationStatus(
    @Param('id') id: string,
    @Body() body: { status: 'resolved' | 'needs_follow_up' | 'replied' | 'unread' },
  ) {
    return this.conversations.updateStatus(Number(id), body.status);
  }

  @Post('categories')
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.categories.create(dto);
  }

  @Patch('categories/:id')
  updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categories.update(id, dto);
  }

  @Delete('categories/:id')
  @HttpCode(200)
  async removeCategory(@Param('id') id: string) {
    await this.categories.remove(id);
    return { success: true };
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
