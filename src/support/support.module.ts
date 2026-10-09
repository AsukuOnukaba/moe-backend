import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ContactController } from './contact.controller';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';

@Module({
  imports: [DatabaseModule],
  controllers: [SupportController, ContactController],
  providers: [SupportService],
  exports: [SupportService],
})
export class SupportModule {}

