import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ContactController } from './contact.controller';
import { AdminOrderComplaintsController, SupportController } from './support.controller';
import { SupportService } from './support.service';

@Module({
  imports: [DatabaseModule],
  controllers: [SupportController, ContactController, AdminOrderComplaintsController],
  providers: [SupportService],
  exports: [SupportService],
})
export class SupportModule {}
