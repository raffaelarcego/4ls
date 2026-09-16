import { Module } from '@nestjs/common';
import { ConceptsModule } from '../concepts/concepts.module';
import { ErrorsModule } from '../errors/errors.module';
import { StructureController } from './structure.controller';
import { StructureService } from './structure.service';

@Module({
  imports: [ConceptsModule, ErrorsModule],
  controllers: [StructureController],
  providers: [StructureService],
  exports: [StructureService],
})
export class StructureModule {}
