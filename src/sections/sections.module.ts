import { Module } from '@nestjs/common';
import { ScoringModule } from '../scoring/scoring.module';
import { SectionsService } from './sections.service';
import { SectionsController } from './sections.controller';
import { AdminSectionsController } from './admin-sections.controller';

@Module({
  imports: [ScoringModule],
  controllers: [SectionsController, AdminSectionsController],
  providers: [SectionsService],
  exports: [SectionsService],
})
export class SectionsModule {}
