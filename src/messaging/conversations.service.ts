import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import type { AccessTokenPayload } from '../auth/types/jwt-payload';
import { NotificationsService } from '../notifications/notifications.service';
import {
  isCloudinaryConfigured,
  signedAuthenticatedUrl,
} from '../upload/cloudinary';
import {
  MESSAGE_ATTACHMENT_MAX_BYTES,
  MESSAGE_VOICE_MAX_BYTES,
  MESSAGE_VOICE_MIN_BYTES,
  cloudinaryPublicId,
  cloudinaryResourceType,
  messageAttachmentKind,
} from '../upload/multer.config';

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  private computeUnreadCount(
    messages: { senderRole: string; senderType: string; readAt: Date | null }[],
    viewerRole: 'customer' | 'artisan' | 'admin',
  ) {
    return messages.filter((m) => {
      if (m.readAt !== null) return false;
      if (viewerRole === 'customer') {
        return m.senderRole === 'admin' || m.senderType === 'provider';
      }
      if (viewerRole === 'artisan' || viewerRole === 'admin') {
        return m.senderRole === 'customer' || m.senderType === 'customer';
      }
      return false;
    }).length;
  }

  private toConversationDto(
    row: {
      id: number;
      customerId: number;
      providerId: number;
      lastMessage: string | null;
      lastMessageTime: Date | null;
      artisanNote?: string | null;
      status?: string;
      deletedAt?: Date | null;
      customer: { name: string; email?: string };
      provider: { brandName: string | null; user: { name: string } };
    },
    unreadCount: number,
    opts?: {
      includeArtisanNote?: boolean;
      viewerContext?: 'as_customer' | 'as_provider';
      includeCustomerEmail?: boolean;
    },
  ) {
    const providerName =
      row.provider.brandName ?? row.provider.user.name ?? '';
    const includeNote = opts?.includeArtisanNote === true;
    return {
      id: row.id,
      customerId: row.customerId,
      providerId: row.providerId,
      artisanId: row.providerId,
      customerName: row.customer.name ?? '',
      ...(opts?.includeCustomerEmail
        ? { customerEmail: row.customer.email ?? '' }
        : {}),
      providerName,
      artisanName: providerName,
      lastMessage: row.lastMessage ?? '',
      lastMessageTime: (row.lastMessageTime ?? new Date()).toISOString(),
      lastMessageAt: (row.lastMessageTime ?? new Date()).toISOString(),
      status: row.status ?? 'unread',
      /** Role of the viewer in this conversation — not their global account role. */
      viewerContext: opts?.viewerContext,
      ...(includeNote ? { artisanNote: row.artisanNote ?? null } : {}),
      unreadCount,
    };
  }

  /** Active conversations only (soft-deleted rows are archived). */
  private activeConversationWhere(
    extra: Record<string, unknown> = {},
  ): Record<string, unknown> {
    return { deletedAt: null, ...extra };
  }

  private viewerSideFor(
    user: AccessTokenPayload,
    conversation: { customerId: number; providerId: number },
  ): 'as_customer' | 'as_provider' | null {
    if (conversation.customerId === user.sub) return 'as_customer';
    if (conversation.providerId === user.sub) return 'as_provider';
    return null;
  }

  private parseListAs(
    raw: unknown,
  ): 'customer' | 'provider' | undefined {
    if (raw === 'customer' || raw === 'provider') return raw;
    return undefined;
  }

  private attachmentDownloadPath(conversationId: number, messageId: number) {
    return `/conversations/${conversationId}/messages/${messageId}/attachment`;
  }

  private normalizeAttachmentKind(
    kind?: string | null,
  ): 'image' | 'document' | 'voice' {
    if (kind === 'image' || kind === 'voice') return kind;
    return 'document';
  }

  private formatVoiceDuration(durationMs?: number | null): string {
    const totalSec = Math.max(0, Math.round((durationMs ?? 0) / 1000));
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  private toMessageDto(message: {
    id: number;
    conversationId: number;
    senderId: number;
    senderType: string;
    senderRole: string;
    content: string;
    sentAt: Date;
    readAt: Date | null;
    attachmentPublicId?: string | null;
    attachmentResourceType?: string | null;
    attachmentName?: string | null;
    attachmentMimeType?: string | null;
    attachmentBytes?: number | null;
    attachmentKind?: string | null;
    durationMs?: number | null;
  }) {
    const hasAttachment = Boolean(message.attachmentPublicId);
    const kind = this.normalizeAttachmentKind(message.attachmentKind);
    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      senderType: message.senderType,
      senderRole: message.senderRole,
      content: message.content,
      sentAt: message.sentAt.toISOString(),
      readAt: message.readAt?.toISOString() ?? null,
      durationMs: message.durationMs ?? null,
      attachment: hasAttachment
        ? {
            name: message.attachmentName ?? 'attachment',
            mimeType: message.attachmentMimeType ?? 'application/octet-stream',
            bytes: message.attachmentBytes ?? null,
            kind,
            durationMs: message.durationMs ?? null,
            // Auth-gated path — never expose a raw Cloudinary URL.
            url: this.attachmentDownloadPath(
              message.conversationId,
              message.id,
            ),
          }
        : null,
    };
  }

  private conversationInclude() {
    return {
      customer: { select: { name: true, email: true } },
      provider: {
        include: { user: { select: { name: true } } },
      },
      messages: { orderBy: { sentAt: 'asc' as const } },
    };
  }

  private async emitMessageNotification(
    conversation: {
      id: number;
      customerId: number;
      providerId: number;
      customer: { name: string };
      provider: { brandName: string | null; user: { name: string } };
    },
    message: { id: number; senderType: string; content: string },
  ) {
    const isCustomerSender = message.senderType === 'customer';
    const recipientId = isCustomerSender
      ? conversation.providerId
      : conversation.customerId;
    const senderName = isCustomerSender
      ? conversation.customer.name
      : (conversation.provider.brandName ??
        conversation.provider.user.name ??
        '');

    await this.notifications.notifyNewMessage({
      recipientId,
      senderName,
      content: message.content,
      conversationId: conversation.id,
      messageId: message.id,
    });
  }

  /**
   * List conversations by the caller's role *in each conversation*:
   * - as=customer → threads the user initiated as buyer (Floating Messages)
   * - as=provider → threads targeting the user as artisan (Customer Inquiries)
   * When `as` is omitted, fall back to JWT role for backward compatibility.
   */
  async list(
    user: AccessTokenPayload,
    query?: { as?: string },
  ) {
    if (user.role !== 'customer' && user.role !== 'artisan') {
      throw new ForbiddenException({
        message: 'Forbidden',
        code: 'FORBIDDEN',
      });
    }

    const requested = this.parseListAs(query?.as);
    const side: 'customer' | 'provider' =
      requested ?? (user.role === 'artisan' ? 'provider' : 'customer');

    if (side === 'provider') {
      return this.listForProvider(user);
    }
    return this.listForCustomer(user);
  }

  private async listForCustomer(customer: AccessTokenPayload) {
    const rows = await this.prisma.conversation.findMany({
      where: this.activeConversationWhere({ customerId: customer.sub }),
      include: this.conversationInclude(),
      orderBy: { lastMessageTime: 'desc' },
    });

    return rows.map((row) =>
      this.toConversationDto(
        row,
        this.computeUnreadCount(row.messages, 'customer'),
        { includeArtisanNote: false, viewerContext: 'as_customer' },
      ),
    );
  }

  private async listForProvider(provider: AccessTokenPayload) {
    const rows = await this.prisma.conversation.findMany({
      where: this.activeConversationWhere({ providerId: provider.sub }),
      include: this.conversationInclude(),
      orderBy: { lastMessageTime: 'desc' },
    });

    return rows.map((row) =>
      this.toConversationDto(
        row,
        this.computeUnreadCount(row.messages, 'artisan'),
        { includeArtisanNote: true, viewerContext: 'as_provider' },
      ),
    );
  }

  async start(customer: AccessTokenPayload, body: { providerId?: number; initialMessage?: string }) {
    const customerId = customer.sub;
    const providerId = Number(body?.providerId ?? 0);
    const initialMessage =
      typeof body?.initialMessage === 'string' ? body.initialMessage.trim() : '';
    if (!providerId) {
      return { message: 'Missing providerId', code: 'VALIDATION_ERROR' };
    }

    const provider = await this.prisma.artisanProfile.findUnique({
      where: { userId: providerId },
      include: { user: { select: { name: true } } },
    });
    if (!provider) {
      throw new NotFoundException({
        message: 'Not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    let conversation = await this.prisma.conversation.findUnique({
      where: { customerId_providerId: { customerId, providerId } },
      include: this.conversationInclude(),
    });

    if (conversation?.deletedAt) {
      conversation = await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          deletedAt: null,
          lastMessage: initialMessage || conversation.lastMessage,
          lastMessageTime: initialMessage
            ? new Date()
            : conversation.lastMessageTime,
          status: 'unread',
        },
        include: this.conversationInclude(),
      });
    }

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          customerId,
          providerId,
          lastMessage: initialMessage || null,
          lastMessageTime: initialMessage ? new Date() : null,
        },
        include: this.conversationInclude(),
      });
    }

    if (initialMessage) {
      const createdMessage = await this.prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId: customerId,
          senderType: 'customer',
          senderRole: 'customer',
          content: initialMessage,
        },
      });
      conversation = await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessage: initialMessage,
          lastMessageTime: new Date(),
        },
        include: this.conversationInclude(),
      });
      await this.emitMessageNotification(conversation, createdMessage);
    }

    return this.toConversationDto(
      conversation,
      this.computeUnreadCount(conversation.messages, 'customer'),
    );
  }

  private async getConversationForUser(
    user: AccessTokenPayload,
    conversationId: number,
  ) {
    // Authorize by participation in this conversation, not global JWT role.
    const row = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        deletedAt: null,
        OR: [{ customerId: user.sub }, { providerId: user.sub }],
      },
      include: this.conversationInclude(),
    });
    if (!row) {
      throw new NotFoundException({
        message: 'Not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }
    return row;
  }

  async getOne(user: AccessTokenPayload, conversationId: number) {
    const row = await this.getConversationForUser(user, conversationId);
    const side = this.viewerSideFor(user, row);
    const viewerRole =
      side === 'as_provider' ? 'artisan' : side === 'as_customer' ? 'customer' : 'customer';
    return this.toConversationDto(
      row,
      this.computeUnreadCount(row.messages, viewerRole),
      {
        includeArtisanNote: side === 'as_provider',
        viewerContext: side ?? undefined,
      },
    );
  }

  async listMessages(user: AccessTokenPayload, conversationId: number) {
    const row = await this.getConversationForUser(user, conversationId);
    return row.messages.map((m) => this.toMessageDto(m));
  }

  private parseDurationMs(raw: unknown): number | null {
    if (raw == null || raw === '') return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.min(Math.round(n), 60 * 60 * 1000);
  }

  private parseClientKey(raw: unknown): string | null {
    if (typeof raw !== 'string') return null;
    const key = raw.trim().slice(0, 128);
    return key || null;
  }

  private assertValidAttachmentFile(file: Express.Multer.File) {
    const kind = messageAttachmentKind(file.mimetype);
    const size = file.size ?? 0;
    if (kind === 'voice') {
      if (size < MESSAGE_VOICE_MIN_BYTES) {
        throw new BadRequestException({
          message: 'Voice recording is empty or too short',
          code: 'EMPTY_RECORDING',
        });
      }
      if (size > MESSAGE_VOICE_MAX_BYTES) {
        throw new BadRequestException({
          message: 'Voice recording exceeds the 10MB upload limit',
          code: 'FILE_TOO_LARGE',
        });
      }
      return;
    }
    if (size > MESSAGE_ATTACHMENT_MAX_BYTES) {
      throw new BadRequestException({
        message: 'File exceeds the 5MB upload limit',
        code: 'FILE_TOO_LARGE',
      });
    }
  }

  private attachmentPreview(
    kind: 'image' | 'document' | 'voice',
    name: string,
    durationMs?: number | null,
  ) {
    if (kind === 'image') return '📷 Image';
    if (kind === 'voice') {
      return `🎤 Voice message (${this.formatVoiceDuration(durationMs)})`;
    }
    return `📎 ${name}`;
  }

  async sendMessage(
    user: AccessTokenPayload,
    conversationId: number,
    body: { content?: string; durationMs?: string | number; clientKey?: string },
    file?: Express.Multer.File,
  ) {
    const row = await this.getConversationForUser(user, conversationId);

    // Support-response policy: the targeted provider cannot reply in-thread.
    // Dual-hat artisans may still send when they are the customer in this conversation.
    if (row.providerId === user.sub && row.customerId !== user.sub) {
      throw new ForbiddenException({
        message: 'Artisans cannot send messages directly. Use a private note instead.',
        code: 'FORBIDDEN',
      });
    }
    if (row.customerId !== user.sub) {
      throw new ForbiddenException({
        message: 'Forbidden',
        code: 'FORBIDDEN',
      });
    }

    const content = typeof body?.content === 'string' ? body.content.trim() : '';
    const clientKey = this.parseClientKey(body?.clientKey);
    const durationMs = this.parseDurationMs(body?.durationMs);

    if (clientKey) {
      const existing = await this.prisma.message.findFirst({
        where: { conversationId, clientKey },
      });
      if (existing) {
        return this.toMessageDto(existing);
      }
    }

    if (!content && !file) {
      throw new BadRequestException({
        message: 'Message text or attachment is required',
        code: 'VALIDATION_ERROR',
      });
    }

    if (file && !isCloudinaryConfigured()) {
      throw new ServiceUnavailableException({
        message:
          'Message attachments require Cloudinary. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.',
        code: 'STORAGE_NOT_CONFIGURED',
      });
    }

    if (file) {
      this.assertValidAttachmentFile(file);
    }

    const senderType =
      row.customerId === user.sub ? 'customer' : 'provider';
    const senderRole = row.customerId === user.sub ? 'customer' : 'admin';

    const kind = file ? messageAttachmentKind(file.mimetype) : null;
    if (kind === 'voice' && durationMs != null && durationMs < 400) {
      throw new BadRequestException({
        message: 'Voice recording is empty or too short',
        code: 'EMPTY_RECORDING',
      });
    }

    const attachmentName = file
      ? file.originalname || (kind === 'voice' ? 'voice-note' : 'attachment')
      : 'attachment';
    const attachmentData = file
      ? {
          attachmentPublicId: cloudinaryPublicId(file),
          attachmentResourceType: cloudinaryResourceType(file, file.mimetype),
          attachmentName,
          attachmentMimeType: file.mimetype,
          attachmentBytes: file.size ?? null,
          attachmentKind: kind,
          durationMs: kind === 'voice' ? durationMs : null,
          ...(clientKey ? { clientKey } : {}),
        }
      : clientKey
        ? { clientKey }
        : {};

    const preview =
      content ||
      (file && kind
        ? this.attachmentPreview(kind, attachmentName, durationMs)
        : '');

    try {
      const message = await this.prisma.message.create({
        data: {
          conversationId,
          senderId: user.sub,
          senderType,
          senderRole,
          content: content || preview,
          ...attachmentData,
        },
      });

      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessage: preview, lastMessageTime: new Date() },
      });

      await this.emitMessageNotification(row, message);

      return this.toMessageDto(message);
    } catch (err: unknown) {
      // Unique clientKey race — return the first persisted message.
      if (
        clientKey &&
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code?: string }).code === 'P2002'
      ) {
        const existing = await this.prisma.message.findFirst({
          where: { conversationId, clientKey },
        });
        if (existing) return this.toMessageDto(existing);
      }
      throw err;
    }
  }

  async getAttachmentAccess(
    user: AccessTokenPayload,
    conversationId: number,
    messageId: number,
  ) {
    const isAdmin = user.role === 'admin';
    const conversation = isAdmin
      ? await this.prisma.conversation.findFirst({
          where: { id: conversationId, deletedAt: null },
        })
      : await this.getConversationForUser(user, conversationId);

    if (!conversation) {
      throw new NotFoundException({
        message: 'Not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    const message = await this.prisma.message.findFirst({
      where: { id: messageId, conversationId },
    });
    if (!message?.attachmentPublicId) {
      throw new NotFoundException({
        message: 'Attachment not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    if (!isCloudinaryConfigured()) {
      throw new ServiceUnavailableException({
        message:
          'Message attachments require Cloudinary. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.',
        code: 'STORAGE_NOT_CONFIGURED',
      });
    }

    const url = signedAuthenticatedUrl(
      message.attachmentPublicId,
      message.attachmentResourceType || 'image',
      120,
    );

    return {
      url,
      name: message.attachmentName ?? 'attachment',
      mimeType: message.attachmentMimeType ?? 'application/octet-stream',
      kind: this.normalizeAttachmentKind(message.attachmentKind),
      durationMs: message.durationMs ?? null,
      expiresInSeconds: 120,
    };
  }

  async markRead(user: AccessTokenPayload, conversationId: number) {
    const row = await this.getConversationForUser(user, conversationId);
    const side = this.viewerSideFor(user, row);
    const asProvider = side === 'as_provider';

    const unreadSenderType = asProvider ? 'customer' : 'provider';
    const unreadSenderRole = asProvider ? 'customer' : 'admin';

    const now = new Date();
    await this.prisma.message.updateMany({
      where: {
        conversationId,
        readAt: null,
        OR: [
          { senderRole: unreadSenderRole },
          { senderType: unreadSenderType },
        ],
      },
      data: { readAt: now },
    });

    await this.prisma.conversation.update({
      where: { id: row.id },
      data: { lastMessageTime: now },
    });

    return { success: true };
  }

  private participantWhere(
    user: AccessTokenPayload,
    as?: 'customer' | 'provider',
  ) {
    const side =
      as ?? (user.role === 'artisan' ? 'provider' : 'customer');
    if (side === 'provider') {
      return this.activeConversationWhere({ providerId: user.sub });
    }
    if (user.role === 'customer' || user.role === 'artisan') {
      return this.activeConversationWhere({ customerId: user.sub });
    }
    return null;
  }

  private isParticipant(
    conversation: { customerId: number; providerId: number },
    user: AccessTokenPayload,
  ) {
    return (
      conversation.customerId === user.sub || conversation.providerId === user.sub
    );
  }

  private bulkDeleteAllowed() {
    const flag = this.config.get<string>('ALLOW_CONVERSATION_BULK_DELETE');
    const nodeEnv = this.config.get<string>('NODE_ENV') ?? 'development';
    return flag === 'true' || nodeEnv !== 'production';
  }

  private async softDeleteConversations(ids: number[]) {
    if (ids.length === 0) return 0;
    const now = new Date();
    await this.notifications.deleteMessageNotificationsForConversations(ids);
    const result = await this.prisma.conversation.updateMany({
      where: { id: { in: ids }, deletedAt: null },
      data: { deletedAt: now },
    });
    return result.count;
  }

  async deleteOne(user: AccessTokenPayload, conversationId: number) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation || conversation.deletedAt) {
      throw new NotFoundException({
        message: 'Not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    if (!this.isParticipant(conversation, user)) {
      throw new ForbiddenException({
        message: 'Forbidden',
        code: 'FORBIDDEN',
      });
    }

    await this.softDeleteConversations([conversationId]);
  }

  async deleteAllForUser(
    user: AccessTokenPayload,
    query?: { as?: string },
  ) {
    if (!this.bulkDeleteAllowed()) {
      throw new ForbiddenException({
        message: 'Bulk conversation delete is disabled',
        code: 'FORBIDDEN',
      });
    }

    const as = this.parseListAs(query?.as);
    const participantFilter = this.participantWhere(user, as);
    if (!participantFilter) {
      throw new ForbiddenException({
        message: 'Forbidden',
        code: 'FORBIDDEN',
      });
    }

    const conversations = await this.prisma.conversation.findMany({
      where: participantFilter,
      select: { id: true },
    });

    if (conversations.length === 0) {
      return { deleted: 0 };
    }

    const ids = conversations.map((c) => c.id);
    const deleted = await this.softDeleteConversations(ids);
    return { deleted };
  }

  async listForAdmin(query: {
    page?: number;
    pageSize?: number;
    status?: string;
    q?: string;
  }) {
    const page = Math.max(1, Number(query?.page ?? 1));
    const pageSize = Math.max(1, Math.min(100, Number(query?.pageSize ?? 20)));
    const skip = (page - 1) * pageSize;
    const statusFilter =
      typeof query?.status === 'string' && query.status.trim()
        ? query.status.trim()
        : undefined;
    const q =
      typeof query?.q === 'string' && query.q.trim()
        ? query.q.trim().slice(0, 200)
        : undefined;

    const where: Record<string, unknown> = { deletedAt: null };
    if (statusFilter) where.status = statusFilter;

    if (q) {
      const idNum = Number(q);
      const or: Record<string, unknown>[] = [
        { lastMessage: { contains: q, mode: 'insensitive' } },
        { customer: { name: { contains: q, mode: 'insensitive' } } },
        { customer: { email: { contains: q, mode: 'insensitive' } } },
        { provider: { brandName: { contains: q, mode: 'insensitive' } } },
        { provider: { user: { name: { contains: q, mode: 'insensitive' } } } },
        {
          messages: {
            some: { content: { contains: q, mode: 'insensitive' } },
          },
        },
      ];
      if (Number.isFinite(idNum) && idNum > 0) {
        or.push({ id: Math.trunc(idNum) });
      }
      where.OR = or;
    }

    const [totalItems, rows] = await Promise.all([
      this.prisma.conversation.count({ where }),
      this.prisma.conversation.findMany({
        where,
        include: this.conversationInclude(),
        orderBy: { lastMessageTime: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);

    return {
      data: rows.map((row) =>
        this.toConversationDto(
          row,
          this.computeUnreadCount(row.messages, 'admin'),
          { includeArtisanNote: true, includeCustomerEmail: true },
        ),
      ),
      pagination: {
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
        totalItems,
      },
    };
  }

  async adminReply(
    admin: AccessTokenPayload,
    conversationId: number,
    body: { content?: string; durationMs?: string | number; clientKey?: string },
    file?: Express.Multer.File,
  ) {
    const content = typeof body?.content === 'string' ? body.content.trim() : '';
    const clientKey = this.parseClientKey(body?.clientKey);
    const durationMs = this.parseDurationMs(body?.durationMs);

    if (!content && !file) {
      throw new BadRequestException({
        message: 'Message text or attachment is required',
        code: 'VALIDATION_ERROR',
      });
    }

    const row = await this.prisma.conversation.findFirst({
      where: { id: conversationId, deletedAt: null },
      include: this.conversationInclude(),
    });
    if (!row) {
      throw new NotFoundException({
        message: 'Not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    if (clientKey) {
      const existing = await this.prisma.message.findFirst({
        where: { conversationId, clientKey },
      });
      if (existing) return this.toMessageDto(existing);
    }

    if (file && !isCloudinaryConfigured()) {
      throw new ServiceUnavailableException({
        message:
          'Message attachments require Cloudinary. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.',
        code: 'STORAGE_NOT_CONFIGURED',
      });
    }

    if (file) this.assertValidAttachmentFile(file);

    const kind = file ? messageAttachmentKind(file.mimetype) : null;
    if (kind === 'voice' && durationMs != null && durationMs < 400) {
      throw new BadRequestException({
        message: 'Voice recording is empty or too short',
        code: 'EMPTY_RECORDING',
      });
    }

    const attachmentName = file
      ? file.originalname || (kind === 'voice' ? 'voice-note' : 'attachment')
      : 'attachment';
    const attachmentData = file
      ? {
          attachmentPublicId: cloudinaryPublicId(file),
          attachmentResourceType: cloudinaryResourceType(file, file.mimetype),
          attachmentName,
          attachmentMimeType: file.mimetype,
          attachmentBytes: file.size ?? null,
          attachmentKind: kind,
          durationMs: kind === 'voice' ? durationMs : null,
          ...(clientKey ? { clientKey } : {}),
        }
      : clientKey
        ? { clientKey }
        : {};

    const preview =
      content ||
      (file && kind
        ? this.attachmentPreview(kind, attachmentName, durationMs)
        : '');

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId: admin.sub,
        senderType: 'provider',
        senderRole: 'admin',
        content: content || preview,
        ...attachmentData,
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessage: preview,
        lastMessageTime: new Date(),
        status: 'replied',
      },
    });

    await this.notifications.notifyNewMessage({
      recipientId: row.customerId,
      senderName: 'MoE Support',
      content: preview,
      conversationId: row.id,
      messageId: message.id,
    });

    return this.toMessageDto(message);
  }

  async updateStatus(
    conversationId: number,
    status: 'resolved' | 'needs_follow_up' | 'replied' | 'unread',
  ) {
    const row = await this.prisma.conversation.findFirst({
      where: { id: conversationId, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException({
        message: 'Not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { status },
    });

    return { success: true, status };
  }

  async updateArtisanNote(
    artisan: AccessTokenPayload,
    conversationId: number,
    note: string,
  ) {
    if (artisan.role !== 'artisan') {
      throw new ForbiddenException({
        message: 'Only artisans can send private support notes',
        code: 'FORBIDDEN',
      });
    }

    const trimmed = note.trim();
    if (!trimmed) {
      throw new BadRequestException({
        message: 'Note cannot be empty',
        code: 'VALIDATION_ERROR',
      });
    }

    const row = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        providerId: artisan.sub,
        deletedAt: null,
      },
    });
    if (!row) {
      throw new NotFoundException({
        message: 'Not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { artisanNote: trimmed },
    });

    return { success: true, artisanNote: trimmed };
  }

  async getMessagesForAdmin(conversationId: number) {
    const row = await this.prisma.conversation.findFirst({
      where: { id: conversationId, deletedAt: null },
      include: this.conversationInclude(),
    });
    if (!row) {
      throw new NotFoundException({
        message: 'Not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    return {
      conversation: this.toConversationDto(
        row,
        this.computeUnreadCount(row.messages, 'admin'),
        { includeArtisanNote: true, includeCustomerEmail: true },
      ),
      messages: row.messages.map((m) => this.toMessageDto(m)),
    };
  }

  async adminDelete(conversationId: number) {
    const row = await this.prisma.conversation.findFirst({
      where: { id: conversationId, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException({
        message: 'Not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    await this.softDeleteConversations([conversationId]);
    return { success: true };
  }

  async adminBulkDelete(ids: unknown) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestException({
        message: 'ids must be a non-empty array',
        code: 'VALIDATION_ERROR',
      });
    }
    const parsed = [
      ...new Set(
        ids
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id) && id > 0)
          .map((id) => Math.trunc(id)),
      ),
    ].slice(0, 200);

    if (parsed.length === 0) {
      throw new BadRequestException({
        message: 'No valid conversation ids',
        code: 'VALIDATION_ERROR',
      });
    }

    const deleted = await this.softDeleteConversations(parsed);
    return { success: true, deleted };
  }
}
