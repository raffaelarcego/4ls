import { Module } from '@nestjs/common';
import { AlphabetModule } from '../alphabet/alphabet.module';
import { ErrorsModule } from '../errors/errors.module';
import { FoundationModule } from '../foundation/foundation.module';
import { GamificationModule } from '../gamification/gamification.module';
import { ReviewModule } from '../review/review.module';
import { StudyController } from './study.controller';
import { StudyService } from './study.service';

@Module({
  imports: [ReviewModule, ErrorsModule, GamificationModule, AlphabetModule, FoundationModule],
  controllers: [StudyController],
  providers: [StudyService],
  exports: [StudyService],
})
export class StudyModule {}
