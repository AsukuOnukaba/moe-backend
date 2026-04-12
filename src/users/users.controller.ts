import {
  Body,
  Controller,
  Delete,
  Get,
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
import { UsersService } from './users.service';

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

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Post('me/addresses')
  async createAddress(@Req() req: Request, @Body() dto: CreateAddressDto) {
    const user = req.user as AccessTokenPayload | undefined;
    return this.users.createAddress(user!.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/addresses')
  async getAddresses(@Req() req: Request) {
    const user = req.user as AccessTokenPayload | undefined;
    return this.users.getAddresses(user!.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/addresses/:id')
  async updateAddress(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateAddressDto,
  ) {
    const user = req.user as AccessTokenPayload | undefined;
    return this.users.updateAddress(user!.sub, Number(id), dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/addresses/:id/default')
  async setDefaultAddress(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as AccessTokenPayload | undefined;
    return this.users.setDefaultAddress(user!.sub, Number(id));
  }

  @UseGuards(JwtAuthGuard)
  @Delete('me/addresses/:id')
  async deleteAddress(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as AccessTokenPayload | undefined;
    return this.users.deleteAddress(user!.sub, Number(id));
  }
}
