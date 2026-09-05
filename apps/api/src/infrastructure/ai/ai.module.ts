import { Global, Module } from '@nestjs/common';
import { AiRouterService } from './ai-router.service';
import { MimoProvider } from './mimo.provider';
import { OpenRouterProvider } from './openrouter.provider';

@Global()
@Module({
  providers: [MimoProvider, OpenRouterProvider, AiRouterService],
  exports: [AiRouterService],
})
export class AiModule {}
