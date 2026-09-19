import { Module } from '@nestjs/common';
import { AlphabetController } from './alphabet.controller';
import { AlphabetService } from './alphabet.service';

@Module({
  controllers: [AlphabetController],
  providers: [AlphabetService],
  // O planejador da sessao precisa perguntar se o idioma ainda esta na trilha.
  exports: [AlphabetService],
})
export class AlphabetModule {}
