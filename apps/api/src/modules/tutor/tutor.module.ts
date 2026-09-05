import { Module } from '@nestjs/common';
import { ErrorsModule } from '../errors/errors.module';
import { VocabularyModule } from '../vocabulary/vocabulary.module';
import { TutorController } from './tutor.controller';
import { TutorService } from './tutor.service';

@Module({
  imports: [ErrorsModule, VocabularyModule],
  controllers: [TutorController],
  providers: [TutorService],
  exports: [TutorService],
})
export class TutorModule {}
