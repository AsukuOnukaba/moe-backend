import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  doSearch(@Query() query: any) {
    const q = typeof query?.q === 'string' ? query.q : '';
    const type = typeof query?.type === 'string' ? query.type : 'all';
    return this.search.search(q, type);
  }
}

