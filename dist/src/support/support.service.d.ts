type SupportTicket = {
    id: number;
    customerId: number | null;
    type: 'contact' | 'order_issue' | 'report' | 'return_request';
    orderId: string | null;
    subject: string;
    description: string;
    email: string;
    status: 'open' | 'in_review' | 'resolved' | 'closed';
    createdAt: string;
};
export declare class SupportService {
    private all;
    create(body: any, customerId: number | null): Promise<SupportTicket>;
    list(customerId: number): Promise<SupportTicket[]>;
}
export {};
