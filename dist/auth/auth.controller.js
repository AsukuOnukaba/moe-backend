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
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const crypto_1 = require("crypto");
const multer_1 = __importDefault(require("multer"));
const auth_service_1 = require("./auth.service");
const auth_login_dto_1 = require("./dto/auth-login.dto");
const auth_register_dto_1 = require("./dto/auth-register.dto");
const auth_refresh_dto_1 = require("./dto/auth-refresh.dto");
const auth_profile_patch_dto_1 = require("./dto/auth-profile-patch.dto");
const jwt_auth_guard_1 = require("./guards/jwt-auth.guard");
let AuthController = class AuthController {
    auth;
    constructor(auth) {
        this.auth = auth;
    }
    async register(dto) {
        return this.auth.register(dto);
    }
    async login(dto) {
        return this.auth.login(dto);
    }
    async refresh(dto) {
        return this.auth.refresh(dto.refreshToken);
    }
    async profile(req) {
        const user = req.user;
        return this.auth.profile(user.sub);
    }
    async patchProfile(req, dto) {
        const user = req.user;
        return this.auth.patchProfile(user.sub, dto);
    }
    async uploadAvatar(req, file) {
        if (!file) {
            throw new common_1.BadRequestException('Missing file');
        }
        const ext = path_1.default.extname(file.originalname || '').toLowerCase() || '.png';
        const filename = `${(0, crypto_1.randomUUID)()}${ext}`;
        const uploadsDir = path_1.default.join(process.cwd(), 'uploads', 'avatars');
        await fs_1.promises.mkdir(uploadsDir, { recursive: true });
        const filePath = path_1.default.join(uploadsDir, filename);
        await fs_1.promises.writeFile(filePath, file.buffer);
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const avatarUrl = `${baseUrl}/uploads/avatars/${filename}`;
        return this.auth.setAvatar(req.user.sub, avatarUrl);
    }
    async logout(req) {
        const user = req.user;
        return this.auth.logoutAll(user.sub);
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Post)('register'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_register_dto_1.AuthRegisterDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "register", null);
__decorate([
    (0, common_1.Post)('login'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_login_dto_1.AuthLoginDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, common_1.Post)('refresh-token'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_refresh_dto_1.AuthRefreshDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "refresh", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)('profile'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "profile", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Patch)('profile'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, auth_profile_patch_dto_1.AuthProfilePatchDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "patchProfile", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)('profile/avatar'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: multer_1.default.memoryStorage(),
        limits: { fileSize: 10 * 1024 * 1024 },
    })),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "uploadAvatar", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)('logout'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logout", null);
exports.AuthController = AuthController = __decorate([
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map