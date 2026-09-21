import { Module } from '@nestjs/common';
import { MorphologyController } from './morphology.controller';
import { MorphologyService } from './morphology.service';

@Module({
  controllers: [MorphologyController],
  providers: [MorphologyService],
  // O script de warm precisa do servico para declinar as palavras fora do estudo.
  exports: [MorphologyService],
})
export class MorphologyModule {}
