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
const passport_1 = require("@nestjs/passport");
const platform_express_1 = require("@nestjs/platform-express");
const path_1 = __importDefault(require("path"));
const crypto_1 = require("crypto");
const multer_1 = __importDefault(require("multer"));
const auth_service_1 = require("./auth.service");
const auth_login_dto_1 = require("./dto/auth-login.dto");
const auth_register_dto_1 = require("./dto/auth-register.dto");
const auth_refresh_dto_1 = require("./dto/auth-refresh.dto");
const auth_profile_patch_dto_1 = require("./dto/auth-profile-patch.dto");
const update_user_profile_dto_1 = require("./dto/update-user-profile.dto");
const change_password_dto_1 = require("./dto/change-password.dto");
const verify_email_dto_1 = require("./dto/verify-email.dto");
const resend_otp_dto_1 = require("./dto/resend-otp.dto");
const admin_verify_otp_dto_1 = require("./dto/admin-verify-otp.dto");
const jwt_auth_guard_1 = require("./guards/jwt-auth.guard");
const cloudinary_service_1 = require("../common/storage/cloudinary.service");
const config_1 = require("@nestjs/config");
let AuthController = class AuthController {
    auth;
    cloudinary;
    config;
    constructor(auth, cloudinary, config) {
        this.auth = auth;
        this.cloudinary = cloudinary;
        this.config = config;
    }
    async register(dto) {
        return this.auth.register(dto);
    }
    async login(dto) {
        return this.auth.login(dto);
    }
    verifyEmail(dto) {
        return this.auth.verifyEmail(dto.email, dto.otp);
    }
    resendOtp(dto) {
        return this.auth.resendOtp(dto.email);
    }
    verifyAdminOtp(dto) {
        return this.auth.verifyAdminOtp(dto.email, dto.otp);
    }
    googleAuth() {
        return;
    }
    async googleCallback(req, res) {
        const result = await this.auth.handleGoogleLogin(req.user);
        const redirect = this.config.get('GOOGLE_SUCCESS_REDIRECT') ??
            'http://localhost:8080/auth/google/callback';
        const url = new URL(redirect);
        url.searchParams.set('token', result.token);
        url.searchParams.set('refreshToken', result.refreshToken);
        return res.redirect(url.toString());
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
        const url = await this.cloudinary.uploadBuffer(file.buffer, 'avatars', filename);
        await this.auth.setAvatar(req.user.sub, url);
        return { url };
    }
    async logout(req) {
        const user = req.user;
        return this.auth.logoutAll(user.sub);
    }
    async updateProfile(req, dto) {
        const user = req.user;
        return this.auth.updateProfile(user.sub, dto);
    }
    async changePassword(req, dto) {
        const user = req.user;
        return this.auth.changePassword(user.sub, dto);
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
    (0, common_1.Post)('verify-email'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [verify_email_dto_1.VerifyEmailDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "verifyEmail", null);
__decorate([
    (0, common_1.Post)('resend-otp'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [resend_otp_dto_1.ResendOtpDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "resendOtp", null);
__decorate([
    (0, common_1.Post)('admin/verify-otp'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [admin_verify_otp_dto_1.AdminVerifyOtpDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "verifyAdminOtp", null);
__decorate([
    (0, common_1.Get)('google'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('google')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "googleAuth", null);
__decorate([
    (0, common_1.Get)('google/callback'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('google')),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "googleCallback", null);
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
__decorate([
    (0, common_1.Patch)('profile'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, update_user_profile_dto_1.UpdateUserProfileDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "updateProfile", null);
__decorate([
    (0, common_1.Post)('change-password'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, change_password_dto_1.ChangePasswordDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "changePassword", null);
exports.AuthController = AuthController = __decorate([
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        cloudinary_service_1.CloudinaryService,
        config_1.ConfigService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map