import { Module } from '@nestjs/common';
import { CanDoController } from './can-do.controller';
import { CanDoService } from './can-do.service';

@Module({
  controllers: [CanDoController],
  providers: [CanDoService],
  // O script de warm precisa do servico para preparar a aula fora do estudo.
  exports: [CanDoService],
})
export class CanDoModule {}
