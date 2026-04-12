import { PrismaService } from '../database/prisma.service';
export declare class HealthController {
    private readonly prisma;
    constructor(prisma: PrismaService);
    health(): Promise<{
        status: string;
        timestamp: string;
        database: "connected" | "disconnected";
        cache: string;
    }>;
}
