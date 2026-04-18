"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArtisansController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const crypto_1 = require("crypto");
const multer_1 = __importDefault(require("multer"));
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const artisans_service_1 = require("./artisans.service");
const update_artisan_profile_dto_1 = require("./dto/update-artisan-profile.dto");
const create_artisan_product_dto_1 = require("./dto/create-artisan-product.dto");
const update_artisan_product_dto_1 = require("./dto/update-artisan-product.dto");
let ArtisansController = class ArtisansController {
    artisans;
    constructor(artisans) {
        this.artisans = artisans;
    }
    async getAll(page, pageSize, category) {
        const pageNum = page ? Number(page) : 1;
        const sizeNum = pageSize ? Number(pageSize) : 20;
        return this.artisans.getAll(pageNum, sizeNum, category);
    }
    async getMe(req) {
        const user = req.user;
        return this.artisans.getMe(user);
    }
    async patchMe(req, dto) {
        const user = req.user;
        return this.artisans.patchMe(user, dto);
    }
    async listProducts(req, page, pageSize) {
        const user = req.user;
        const pageNum = page ? Number(page) : 1;
        const sizeNum = pageSize ? Number(pageSize) : 20;
        return this.artisans.listProducts(user, pageNum, sizeNum);
    }
    async createProduct(req, dto) {
        const user = req.user;
        return this.artisans.createProduct(user, dto);
    }
    async uploadProductImage(req, file) {
        if (!file) {
            throw new common_1.BadRequestException('Missing file');
        }
        const ext = path_1.default.extname(file.originalname || '').toLowerCase() || '.png';
        const filename = `${(0, crypto_1.randomUUID)()}${ext}`;
        const uploadsDir = path_1.default.join(process.cwd(), 'uploads', 'products');
        await fs_1.promises.mkdir(uploadsDir, { recursive: true });
        const filePath = path_1.default.join(uploadsDir, filename);
        await fs_1.promises.writeFile(filePath, file.buffer);
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const imageUrl = `${baseUrl}/uploads/products/${filename}`;
        return { imageUrl };
    }
    async uploadProfileImage(req, file) {
        if (!file) {
            throw new common_1.BadRequestException({ message: 'No file provided' });
        }
        const ext = path_1.default.extname(file.originalname || '').toLowerCase() || '.png';
        const filename = `${(0, crypto_1.randomUUID)()}${ext}`;
        const uploadsDir = path_1.default.join(process.cwd(), 'uploads', 'artisans');
        await fs_1.promises.mkdir(uploadsDir, { recursive: true });
        const filePath = path_1.default.join(uploadsDir, filename);
        await fs_1.promises.writeFile(filePath, file.buffer);
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const url = `${baseUrl}/uploads/artisans/${filename}`;
        return { url };
    }
    async patchProduct(req, id, dto) {
        const user = req.user;
        return this.artisans.patchProduct(user, Number(id), dto);
    }
    async deleteProduct(req, id) {
        const user = req.user;
        return this.artisans.deleteProduct(user, Number(id));
    }
};
exports.ArtisansController = ArtisansController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('pageSize')),
    __param(2, (0, common_1.Query)('category')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], ArtisansController.prototype, "getAll", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)('me'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ArtisansController.prototype, "getMe", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Patch)('me'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, update_artisan_profile_dto_1.UpdateArtisanProfileDto]),
    __metadata("design:returntype", Promise)
], ArtisansController.prototype, "patchMe", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)('me/products'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('pageSize')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], ArtisansController.prototype, "listProducts", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)('me/products'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_artisan_product_dto_1.CreateArtisanProductDto]),
    __metadata("design:returntype", Promise)
], ArtisansController.prototype, "createProduct", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)('me/products/upload-image'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: multer_1.default.memoryStorage(),
        limits: { fileSize: 10 * 1024 * 1024 },
    })),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ArtisansController.prototype, "uploadProductImage", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)('me/upload-image'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: multer_1.default.memoryStorage(),
        limits: { fileSize: 5 * 1024 * 1024 },
        fileFilter: (req, file, callback) => {
            const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
            if (!allowedMimes.includes(file.mimetype)) {
                return callback(new common_1.BadRequestException({
                    message: 'Unsupported file type. Upload a JPEG, PNG, or WebP image.',
                }));
            }
            callback(null, true);
        },
    })),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ArtisansController.prototype, "uploadProfileImage", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Patch)('me/products/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_artisan_product_dto_1.UpdateArtisanProductDto]),
    __metadata("design:returntype", Promise)
], ArtisansController.prototype, "patchProduct", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Delete)('me/products/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ArtisansController.prototype, "deleteProduct", null);
exports.ArtisansController = ArtisansController = __decorate([
    (0, common_1.Controller)('artisans'),
    __metadata("design:paramtypes", [artisans_service_1.ArtisansService])
], ArtisansController);
//# sourceMappingURL=artisans.controller.js.map