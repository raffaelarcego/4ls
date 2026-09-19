import { Module } from '@nestjs/common';
import { FoundationController } from './foundation.controller';
import { FoundationService } from './foundation.service';

@Module({
  controllers: [FoundationController],
  providers: [FoundationService],
  // O planejador da sessao precisa perguntar se o idioma ainda esta na trilha.
  exports: [FoundationService],
})
export class FoundationModule {}
