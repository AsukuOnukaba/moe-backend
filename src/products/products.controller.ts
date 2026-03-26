import { Controller, Get, Param, Query } from '@nestjs/common';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list(@Query() query: any) {
    return this.products.listProducts(query);
  }

  @Get('recommendations')
  recommendations(@Query() query: any) {
    return this.products.recommendations(query);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    const product = await this.products.getProductById(Number(id));
    if (!product) return { message: 'Not found', code: 'RESOURCE_NOT_FOUND' };
    return product;
  }

  @Get(':id/variants')
  variants(@Param('id') id: string) {
    return this.products.variants(Number(id));
  }
}

