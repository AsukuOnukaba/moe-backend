"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateArtisanProductDto = void 0;
const mapped_types_1 = require("@nestjs/mapped-types");
const create_artisan_product_dto_1 = require("./create-artisan-product.dto");
class UpdateArtisanProductDto extends (0, mapped_types_1.PartialType)(create_artisan_product_dto_1.CreateArtisanProductDto) {
}
exports.UpdateArtisanProductDto = UpdateArtisanProductDto;
//# sourceMappingURL=update-artisan-product.dto.js.map