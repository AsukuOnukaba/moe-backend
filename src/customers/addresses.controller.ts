import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { IsString, IsOptional } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';
import { UsersService } from '../users/users.service';

class CreateAddressDto {
  @IsString()
  addressLine1: string;

  @IsString()
  city: string;

  @IsString()
  state: string;

  @IsString()
  country: string;

  @IsOptional()
  @IsString()
  postalCode?: string;
}

class UpdateAddressDto {
  @IsOptional()
  @IsString()
  addressLine1?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;
}

@Controller('customers/me/addresses')
export class AddressesController {
  constructor(private readonly users: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async getAddresses(@Req() req: Request) {
    const user = req.user as AccessTokenPayload | undefined;
    return this.users.getAddresses(user!.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async createAddress(@Req() req: Request, @Body() dto: CreateAddressDto) {
    const user = req.user as AccessTokenPayload | undefined;
    return this.users.createAddress(user!.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async updateAddress(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateAddressDto,
  ) {
    const user = req.user as AccessTokenPayload | undefined;
    return this.users.updateAddress(user!.sub, Number(id), dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/default')
  async setDefaultAddress(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as AccessTokenPayload | undefined;
    return this.users.setDefaultAddress(user!.sub, Number(id));
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @HttpCode(204)
  async deleteAddress(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as AccessTokenPayload | undefined;
    await this.users.deleteAddress(user!.sub, Number(id));
  }
}
