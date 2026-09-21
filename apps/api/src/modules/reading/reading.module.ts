import { Module } from '@nestjs/common';
import { ReadingController } from './reading.controller';
import { ReadingService } from './reading.service';

@Module({
  controllers: [ReadingController],
  providers: [ReadingService],
  // O script de warm precisa do servico para preparar o texto fora do estudo.
  exports: [ReadingService],
})
export class ReadingModule {}
