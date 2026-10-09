import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AdminDisputesController } from './admin-disputes.controller';
import { DisputesController } from './disputes.controller';
import { DisputesService } from './disputes.service';

@Module({
  imports: [DatabaseModule],
  controllers: [DisputesController, AdminDisputesController],
  providers: [DisputesService],
  exports: [DisputesService],
})
export class DisputesModule {}
