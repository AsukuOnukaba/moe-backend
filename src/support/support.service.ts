import { Injectable } from '@nestjs/common';

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

// TEMP: in-memory tickets.
const ticketStore = new Map<number | 'all', SupportTicket[]>();
let ticketIdSeq = 1;

@Injectable()
export class SupportService {
  private all() {
    const existing = ticketStore.get('all');
    if (existing) return existing;
    const created: SupportTicket[] = [];
    ticketStore.set('all', created);
    return created;
  }

  async create(body: any, customerId: number | null) {
    const type = (body?.type ?? 'contact') as SupportTicket['type'];
    const subject = typeof body?.subject === 'string' ? body.subject : '';
    const description = typeof body?.description === 'string' ? body.description : '';
    const email = typeof body?.email === 'string' ? body.email : '';
    const orderId = typeof body?.orderId === 'string' ? body.orderId : null;

    const ticket: SupportTicket = {
      id: ticketIdSeq++,
      customerId,
      type,
      orderId,
      subject,
      description,
      email,
      status: 'open',
      createdAt: new Date().toISOString(),
    };

    this.all().unshift(ticket);
    return ticket;
  }

  async list(customerId: number) {
    // We store all tickets in one list for now.
    return this.all().filter((t) => t.customerId === customerId);
  }
}

