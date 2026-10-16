import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';

@Injectable()
export class SanitizePipe implements PipeTransform {
  transform(value: unknown, _metadata: ArgumentMetadata) {
    if (typeof value === 'string') {
      return value.trim().replace(/<[^>]*>/g, '');
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.transform(item, _metadata));
    }
    if (typeof value === 'object' && value !== null) {
      return this.sanitizeObject(value as Record<string, unknown>);
    }
    return value;
  }

  private sanitizeObject(obj: Record<string, unknown>) {
    const sanitized: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (typeof val === 'string') {
        sanitized[key] = val.trim().replace(/<[^>]*>/g, '');
      } else if (Array.isArray(val)) {
        sanitized[key] = val.map((item) =>
          typeof item === 'string'
            ? item.trim().replace(/<[^>]*>/g, '')
            : typeof item === 'object' && item !== null
              ? this.sanitizeObject(item as Record<string, unknown>)
              : item,
        );
      } else if (typeof val === 'object' && val !== null) {
        sanitized[key] = this.sanitizeObject(val as Record<string, unknown>);
      } else {
        sanitized[key] = val;
      }
    }
    return sanitized;
  }
}
