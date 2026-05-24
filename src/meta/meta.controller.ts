import { Controller, Get } from '@nestjs/common';
import { SERVICE_CATEGORIES } from '../common/service-categories';

@Controller('meta')
export class MetaController {
  @Get('service-categories')
  serviceCategories() {
    return {
      serviceCategories: SERVICE_CATEGORIES.map((c) => ({
        id: c.id,
        name: c.name,
      })),
    };
  }
}
