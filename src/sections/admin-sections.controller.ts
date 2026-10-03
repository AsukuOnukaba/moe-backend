import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../auth/guards/admin-role.guard';
import { AccessTokenPayload } from '../auth/types/jwt-payload';
import { SectionsService } from './sections.service';
import {
  CuratedItemInputDto,
  ReorderSectionItemsDto,
  ReplaceSectionItemsDto,
  SeasonalKeywordsDto,
} from './dto/curation.dto';
import type { Request } from 'express';

@Controller('admin/sections')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminSectionsController {
  constructor(private readonly sections: SectionsService) {}

  @Get()
  list() {
    return this.sections.listAdminSections();
  }

  /** Declared before `:sectionKey` routes so it is not treated as a key. */
  @Patch('seasonal_picks/keywords')
  seasonalKeywords(@Body() dto: SeasonalKeywordsDto, @Req() req: Request) {
    const admin = req.user as AccessTokenPayload;
    return this.sections.setSeasonalKeywords(dto.keywords, admin.sub);
  }

  @Get(':sectionKey')
  get(@Param('sectionKey') sectionKey: string) {
    return this.sections.getAdminSection(sectionKey);
  }

  @Put(':sectionKey/items')
  replace(
    @Param('sectionKey') sectionKey: string,
    @Body() dto: ReplaceSectionItemsDto,
    @Req() req: Request,
  ) {
    const admin = req.user as AccessTokenPayload;
    return this.sections.replaceItems(sectionKey, dto, admin.sub);
  }

  @Post(':sectionKey/items')
  add(
    @Param('sectionKey') sectionKey: string,
    @Body() dto: CuratedItemInputDto,
    @Req() req: Request,
  ) {
    const admin = req.user as AccessTokenPayload;
    return this.sections.addItem(sectionKey, dto, admin.sub);
  }

  @Delete(':sectionKey/items/:itemId')
  remove(
    @Param('sectionKey') sectionKey: string,
    @Param('itemId') itemId: string,
    @Req() req: Request,
  ) {
    const admin = req.user as AccessTokenPayload;
    return this.sections.removeItem(sectionKey, itemId, admin.sub);
  }

  @Patch(':sectionKey/items/reorder')
  reorder(
    @Param('sectionKey') sectionKey: string,
    @Body() dto: ReorderSectionItemsDto,
    @Req() req: Request,
  ) {
    const admin = req.user as AccessTokenPayload;
    return this.sections.reorderItems(sectionKey, dto, admin.sub);
  }

}
