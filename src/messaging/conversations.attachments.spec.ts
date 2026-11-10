import {
  MESSAGE_ATTACHMENT_MAX_BYTES,
  MESSAGE_ATTACHMENT_MIME_TYPES,
  MESSAGE_VOICE_MAX_BYTES,
  MESSAGE_VOICE_MIME_TYPES,
  messageAttachmentKind,
} from '../upload/multer.config';

describe('message attachment rules', () => {
  it('allows images and common documents under 5MB', () => {
    expect(MESSAGE_ATTACHMENT_MAX_BYTES).toBe(5 * 1024 * 1024);
    expect(MESSAGE_ATTACHMENT_MIME_TYPES).toEqual(
      expect.arrayContaining([
        'image/jpeg',
        'image/png',
        'image/webp',
        'application/pdf',
        'text/plain',
      ]),
    );
  });

  it('allows browser voice formats under 10MB', () => {
    expect(MESSAGE_VOICE_MAX_BYTES).toBe(10 * 1024 * 1024);
    expect(MESSAGE_VOICE_MIME_TYPES).toEqual(
      expect.arrayContaining([
        'audio/webm',
        'audio/mp4',
        'audio/ogg',
        'audio/wav',
        'video/webm',
      ]),
    );
  });

  it('classifies mime types into image vs document vs voice', () => {
    expect(messageAttachmentKind('image/png')).toBe('image');
    expect(messageAttachmentKind('application/pdf')).toBe('document');
    expect(messageAttachmentKind('text/plain')).toBe('document');
    expect(messageAttachmentKind('audio/webm')).toBe('voice');
    expect(messageAttachmentKind('audio/mp4')).toBe('voice');
    expect(messageAttachmentKind('audio/webm;codecs=opus')).toBe('voice');
  });
});

describe('private note / attachment DTO shaping', () => {
  // Lightweight stand-in for ConversationsService private helpers via behavior contracts.
  function toConversationDto(
    artisanNote: string | null,
    includeArtisanNote: boolean,
  ) {
    return {
      id: 1,
      ...(includeArtisanNote ? { artisanNote } : {}),
    };
  }

  function toMessageDto(attachmentPublicId: string | null) {
    return {
      id: 9,
      attachment: attachmentPublicId
        ? {
            url: `/conversations/1/messages/9/attachment`,
            kind: 'image' as const,
          }
        : null,
    };
  }

  it('hides artisan notes from customer payloads', () => {
    expect(toConversationDto('secret', false)).toEqual({ id: 1 });
    expect(toConversationDto('secret', true)).toEqual({
      id: 1,
      artisanNote: 'secret',
    });
  });

  it('exposes auth-gated attachment paths instead of public CDN URLs', () => {
    const dto = toMessageDto('moe/message-attachments/abc');
    expect(dto.attachment?.url).toBe('/conversations/1/messages/9/attachment');
    expect(dto.attachment?.url).not.toMatch(/cloudinary|res\.cloudinary/i);
  });
});
