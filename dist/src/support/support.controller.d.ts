import type { Request } from 'express';
import { SupportService } from './support.service';
export declare class SupportController {
    private readonly support;
    constructor(support: SupportService);
    create(req: Request, body: any): Promise<{
        id: number;
        customerId: number | null;
        type: "contact" | "order_issue" | "report" | "return_request";
        orderId: string | null;
        subject: string;
        description: string;
        email: string;
        status: "open" | "in_review" | "resolved" | "closed";
        createdAt: string;
    }>;
    list(req: Request): Promise<{
        id: number;
        customerId: number | null;
        type: "contact" | "order_issue" | "report" | "return_request";
        orderId: string | null;
        subject: string;
        description: string;
        email: string;
        status: "open" | "in_review" | "resolved" | "closed";
        createdAt: string;
    }[]>;
}
