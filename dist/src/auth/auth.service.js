"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const bcrypt = __importStar(require("bcrypt"));
const crypto_1 = require("crypto");
const prisma_service_1 = require("../database/prisma.service");
function authError(message, code) {
    return new common_1.UnauthorizedException({ message, code });
}
function nowPlusMs(ms) {
    return new Date(Date.now() + ms);
}
function parseExpiresInToMs(expiresIn) {
    const m = /^(\d+)\s*([smhd])$/.exec(expiresIn.trim());
    if (!m)
        throw new Error(`Invalid expires format: ${expiresIn}`);
    const n = Number(m[1]);
    const unit = m[2];
    const mult = unit === 's'
        ? 1000
        : unit === 'm'
            ? 60_000
            : unit === 'h'
                ? 3_600_000
                : 86_400_000;
    return n * mult;
}
let AuthService = class AuthService {
    prisma;
    jwt;
    config;
    constructor(prisma, jwt, config) {
        this.prisma = prisma;
        this.jwt = jwt;
        this.config = config;
    }
    accessExpiresIn() {
        return this.config.get('JWT_ACCESS_EXPIRES_IN', '20m');
    }
    refreshExpiresIn() {
        return this.config.get('JWT_REFRESH_EXPIRES_IN', '30d');
    }
    accessSecret() {
        const v = this.config.get('JWT_ACCESS_SECRET');
        if (!v)
            throw new Error('JWT_ACCESS_SECRET is required');
        return v;
    }
    refreshSecret() {
        const v = this.config.get('JWT_REFRESH_SECRET');
        if (!v)
            throw new Error('JWT_REFRESH_SECRET is required');
        return v;
    }
    async ensureRoleExists(name) {
        await this.prisma.role.upsert({
            where: { name },
            update: {},
            create: { name },
        });
    }
    async ensureUserRole(userId, role) {
        await this.ensureRoleExists(role);
        const r = await this.prisma.role.findUnique({ where: { name: role } });
        if (!r)
            throw new Error('Role upsert failed');
        await this.prisma.userRole.upsert({
            where: { userId_roleId: { userId, roleId: r.id } },
            update: {},
            create: { userId, roleId: r.id },
        });
    }
    async issueTokens(user, role) {
        const accessPayload = {
            sub: user.id,
            email: user.email,
            role,
        };
        const jti = (0, crypto_1.randomUUID)();
        const refreshPayload = { sub: user.id, jti };
        const accessToken = await this.jwt.signAsync(accessPayload, {
            secret: this.accessSecret(),
            expiresIn: this.accessExpiresIn(),
        });
        const refreshToken = await this.jwt.signAsync(refreshPayload, {
            secret: this.refreshSecret(),
            expiresIn: this.refreshExpiresIn(),
        });
        const refreshTtlMs = parseExpiresInToMs(this.refreshExpiresIn());
        await this.prisma.refreshToken.create({
            data: {
                jti,
                userId: user.id,
                expiresAt: nowPlusMs(refreshTtlMs),
            },
        });
        return { token: accessToken, refreshToken };
    }
    async resolvePrimaryRole(userId) {
        const roles = await this.prisma.userRole.findMany({
            where: { userId },
            include: { role: true },
        });
        const names = roles.map((r) => r.role.name);
        if (names.includes('admin'))
            return 'admin';
        if (names.includes('artisan'))
            return 'artisan';
        return 'customer';
    }
    async register(input) {
        const role = (input.role ?? 'customer');
        const existing = await this.prisma.user.findUnique({
            where: { email: input.email.toLowerCase() },
        });
        if (existing) {
            throw new common_1.ConflictException({
                message: 'Email already in use',
                code: 'VALIDATION_ERROR',
                errors: { email: ['Email already in use'] },
            });
        }
        const passwordHash = await bcrypt.hash(input.password, 12);
        const user = await this.prisma.user.create({
            data: {
                name: input.name,
                email: input.email.toLowerCase(),
                passwordHash,
                phone: input.phone ?? null,
            },
        });
        await this.ensureUserRole(user.id, role);
        if (role === 'artisan') {
            const serviceCategories = input.serviceCategories && input.serviceCategories.length > 0
                ? input.serviceCategories.join(',')
                : null;
            await this.prisma.artisanProfile.create({
                data: {
                    userId: user.id,
                    brandName: input.name,
                    heroImage: null,
                    serviceCategories,
                    status: 'pending',
                },
            });
        }
        const tokens = await this.issueTokens(user, role);
        return {
            ...tokens,
            user: await this.toProfile(user, role),
        };
    }
    async login(input) {
        const user = await this.prisma.user.findUnique({
            where: { email: input.email.toLowerCase() },
        });
        if (!user) {
            throw authError('Invalid credentials', 'AUTH_INVALID_CREDENTIALS');
        }
        const ok = await bcrypt.compare(input.password, user.passwordHash);
        if (!ok) {
            throw authError('Invalid credentials', 'AUTH_INVALID_CREDENTIALS');
        }
        const role = await this.resolvePrimaryRole(user.id);
        const tokens = await this.issueTokens(user, role);
        return {
            ...tokens,
            user: await this.toProfile(user, role),
        };
    }
    async handleGoogleLogin(profile) {
        let user = await this.prisma.user.findFirst({
            where: {
                OR: [{ googleId: profile.googleId }, { email: profile.email }],
            },
        });
        if (!user) {
            const passwordHash = await bcrypt.hash((0, crypto_1.randomUUID)(), 12);
            user = await this.prisma.user.create({
                data: {
                    name: profile.name,
                    email: profile.email,
                    passwordHash,
                    googleId: profile.googleId,
                    avatarUrl: profile.avatarUrl,
                },
            });
            await this.ensureUserRole(user.id, 'customer');
        }
        else if (!user.googleId) {
            user = await this.prisma.user.update({
                where: { id: user.id },
                data: {
                    googleId: profile.googleId,
                    avatarUrl: user.avatarUrl ?? profile.avatarUrl,
                },
            });
        }
        const role = await this.resolvePrimaryRole(user.id);
        const tokens = await this.issueTokens(user, role);
        return { ...tokens, user: await this.toProfile(user, role) };
    }
    async refresh(refreshToken) {
        let payload;
        try {
            payload = await this.jwt.verifyAsync(refreshToken, {
                secret: this.refreshSecret(),
            });
        }
        catch {
            throw authError('Refresh token invalid or expired', 'AUTH_REFRESH_FAILED');
        }
        const stored = await this.prisma.refreshToken.findUnique({
            where: { jti: payload.jti },
        });
        if (!stored || stored.revokedAt || stored.expiresAt.getTime() < Date.now()) {
            throw authError('Refresh token invalid or expired', 'AUTH_REFRESH_FAILED');
        }
        await this.prisma.refreshToken.update({
            where: { jti: payload.jti },
            data: { revokedAt: new Date() },
        });
        const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
        if (!user)
            throw authError('Refresh failed', 'AUTH_REFRESH_FAILED');
        const role = await this.resolvePrimaryRole(user.id);
        const tokens = await this.issueTokens(user, role);
        return tokens;
    }
    async logoutAll(userId) {
        await this.prisma.refreshToken.updateMany({
            where: { userId, revokedAt: null },
            data: { revokedAt: new Date() },
        });
        return { success: true };
    }
    async profile(userId) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new common_1.UnauthorizedException({ message: 'Unauthorized', code: 'AUTH_TOKEN_EXPIRED' });
        }
        const role = await this.resolvePrimaryRole(userId);
        const artisanProfile = role === 'artisan' ? await this.prisma.artisanProfile.findUnique({ where: { userId } }) : null;
        return this.toProfile(user, role, artisanProfile);
    }
    async patchProfile(userId, input) {
        const role = await this.resolvePrimaryRole(userId);
        const user = await this.prisma.user.update({
            where: { id: userId },
            data: {
                ...(input.name !== undefined ? { name: input.name } : {}),
                ...(input.email !== undefined ? { email: input.email } : {}),
                ...(input.phone !== undefined ? { phone: input.phone } : {}),
            },
        });
        let artisanProfile = null;
        if (role === 'artisan' && input.artisanProfile) {
            const normalizeCommaList = (value) => {
                if (value === undefined)
                    return undefined;
                if (value === null)
                    return null;
                return Array.isArray(value) ? value.join(',') : value;
            };
            artisanProfile = await this.prisma.artisanProfile.upsert({
                where: { userId },
                create: {
                    userId,
                    brandName: input.artisanProfile.brandName ?? user.name,
                    heroImage: null,
                },
                update: {
                    ...(input.artisanProfile.brandName !== undefined
                        ? { brandName: input.artisanProfile.brandName }
                        : {}),
                    ...(input.artisanProfile.about !== undefined ? { about: input.artisanProfile.about } : {}),
                    ...(input.artisanProfile.city !== undefined ? { city: input.artisanProfile.city } : {}),
                    ...(input.artisanProfile.state !== undefined ? { state: input.artisanProfile.state } : {}),
                    ...(input.artisanProfile.category !== undefined
                        ? { category: input.artisanProfile.category }
                        : {}),
                    ...(input.artisanProfile.styleTags !== undefined
                        ? { styleTags: normalizeCommaList(input.artisanProfile.styleTags) }
                        : {}),
                    ...(input.artisanProfile.serviceCategories !== undefined
                        ? { serviceCategories: normalizeCommaList(input.artisanProfile.serviceCategories) }
                        : {}),
                },
            });
        }
        return this.toProfile(user, role, artisanProfile);
    }
    async setAvatar(userId, avatarUrl) {
        const user = await this.prisma.user.update({
            where: { id: userId },
            data: { avatarUrl },
        });
        const role = await this.resolvePrimaryRole(userId);
        if (role === 'artisan') {
            await this.prisma.artisanProfile.update({
                where: { userId },
                data: { heroImage: avatarUrl },
            });
        }
        const artisanProfile = role === 'artisan' ? await this.prisma.artisanProfile.findUnique({ where: { userId } }) : null;
        return this.toProfile(user, role, artisanProfile);
    }
    async toProfile(user, role, artisanProfile) {
        return {
            id: user.id,
            username: user.email.split('@')[0],
            name: user.name,
            email: user.email,
            phone: user.phone,
            avatarUrl: user.avatarUrl,
            role,
            ...(role === 'artisan'
                ? {
                    artisanProfile: {
                        brandName: artisanProfile?.brandName ?? user.name,
                        about: artisanProfile?.about ?? null,
                        city: artisanProfile?.city ?? null,
                        state: artisanProfile?.state ?? null,
                        category: artisanProfile?.category ?? null,
                        styleTags: artisanProfile?.styleTags ? artisanProfile.styleTags.split(',') : [],
                        serviceCategories: artisanProfile?.serviceCategories
                            ? artisanProfile.serviceCategories.split(',')
                            : [],
                        heroImage: artisanProfile?.heroImage ?? user.avatarUrl ?? null,
                        verified: artisanProfile?.verified ?? false,
                        featured: artisanProfile?.featured ?? false,
                        estimatedDeliveryDays: artisanProfile?.estimatedDeliveryDays ?? 7,
                        customOrdersEnabled: artisanProfile?.customOrdersEnabled ?? false,
                        rating: artisanProfile?.rating ?? 0,
                        reviewCount: artisanProfile?.reviewCount ?? 0,
                    },
                }
                : {}),
            preferences: null,
            createdAt: user.createdAt.toISOString(),
        };
    }
    async updateProfile(userId, dto) {
        const data = Object.fromEntries(Object.entries(dto).filter(([_, v]) => v !== undefined));
        if (Object.keys(data).length === 0) {
            return this.prisma.user.findUnique({ where: { id: userId } });
        }
        const user = await this.prisma.user.update({
            where: { id: userId },
            data,
        });
        const { passwordHash: _, ...result } = user;
        return result;
    }
    async changePassword(userId, dto) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });
        if (!user) {
            throw new common_1.UnauthorizedException('User not found.');
        }
        const isMatch = await bcrypt.compare(dto.currentPassword, user.passwordHash);
        if (!isMatch) {
            throw new common_1.UnauthorizedException('Current password is incorrect.');
        }
        const hash = await bcrypt.hash(dto.newPassword, 10);
        await this.prisma.user.update({
            where: { id: userId },
            data: { passwordHash: hash },
        });
        return { message: 'Password updated successfully' };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        config_1.ConfigService])
], AuthService);
//# sourceMappingURL=auth.service.js.map