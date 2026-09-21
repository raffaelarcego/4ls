import { Module } from '@nestjs/common';
import { AssessmentController } from './assessment.controller';
import { AssessmentService } from './assessment.service';

@Module({
  controllers: [AssessmentController],
  providers: [AssessmentService],
  // O planejador precisa perguntar se a prova do mes ja venceu.
  exports: [AssessmentService],
})
export class AssessmentModule {}
