import { Controller, Get } from '@nestjs/common';
import { ALL_PRODUCT_CATEGORIES } from '../common/product-categories';
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

  @Get('product-categories')
  productCategories() {
    return { categories: [...ALL_PRODUCT_CATEGORIES] };
  }
}
