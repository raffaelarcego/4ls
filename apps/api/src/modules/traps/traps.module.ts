import { Module } from '@nestjs/common';
import { TrapsController } from './traps.controller';
import { TrapsService } from './traps.service';

@Module({
  controllers: [TrapsController],
  providers: [TrapsService],
  // O motor da sessao precisa saber quanta interferencia aberta existe por
  // idioma: e o que decide se o bloco concorre por vaga hoje.
  exports: [TrapsService],
})
export class TrapsModule {}
