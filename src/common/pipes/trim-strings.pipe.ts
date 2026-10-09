import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';
import { stripHtmlTags } from '../sanitize';

const HTML_STRIP_FIELDS = new Set([
  'description',
  'about',
  'message',
  'notes',
  'review',
  'comment',
  'content',
  'body',
  'rejectionReason',
  'reason',
  'artisanNote',
  'refundPolicy',
  'installmentDetails',
]);

function trimDeep(value: unknown, key?: string): unknown {
  if (typeof value === 'string') {
    let s = value.trim();
    if (key && HTML_STRIP_FIELDS.has(key)) {
      s = stripHtmlTags(s);
    }
    return s;
  }
  if (Array.isArray(value)) {
    return value.map((item) => trimDeep(item));
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = trimDeep(v, k);
    }
    return out;
  }
  return value;
}

@Injectable()
export class TrimStringsPipe implements PipeTransform {
  transform(value: unknown, _metadata: ArgumentMetadata) {
    if (value === null || value === undefined) return value;
    return trimDeep(value);
  }
}
