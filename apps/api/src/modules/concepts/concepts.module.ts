import { Module } from '@nestjs/common';
import { ErrorsModule } from '../errors/errors.module';
import { ConceptsController } from './concepts.controller';
import { ConceptsService } from './concepts.service';

@Module({
  imports: [ErrorsModule],
  controllers: [ConceptsController],
  providers: [ConceptsService],
  exports: [ConceptsService],
})
export class ConceptsModule {}
