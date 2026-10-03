import { Controller, Get, Param } from '@nestjs/common';
import { SectionsService } from './sections.service';

/** Public curated homepage sections. */
@Controller('sections')
export class SectionsController {
  constructor(private readonly sections: SectionsService) {}

  @Get('seasonal_picks/matched')
  seasonalMatched() {
    return this.sections.getSeasonalMatched();
  }

  @Get(':sectionKey')
  get(@Param('sectionKey') sectionKey: string) {
    return this.sections.getPublicSection(sectionKey);
  }
}
