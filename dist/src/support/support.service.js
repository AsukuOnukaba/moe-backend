"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupportService = void 0;
const common_1 = require("@nestjs/common");
const ticketStore = new Map();
let ticketIdSeq = 1;
let SupportService = class SupportService {
    all() {
        const existing = ticketStore.get('all');
        if (existing)
            return existing;
        const created = [];
        ticketStore.set('all', created);
        return created;
    }
    async create(body, customerId) {
        const type = (body?.type ?? 'contact');
        const subject = typeof body?.subject === 'string' ? body.subject : '';
        const description = typeof body?.description === 'string' ? body.description : '';
        const email = typeof body?.email === 'string' ? body.email : '';
        const orderId = typeof body?.orderId === 'string' ? body.orderId : null;
        const ticket = {
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
    async list(customerId) {
        return this.all().filter((t) => t.customerId === customerId);
    }
};
exports.SupportService = SupportService;
exports.SupportService = SupportService = __decorate([
    (0, common_1.Injectable)()
], SupportService);
//# sourceMappingURL=support.service.js.map