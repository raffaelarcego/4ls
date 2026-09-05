import { Global, Module } from '@nestjs/common';
import { ElevenLabsProvider } from './elevenlabs.provider';
import { MimoSpeechProvider } from './mimo-speech.provider';
import { OpenAiSpeechProvider } from './openai-speech.provider';
import { SpeechRouterService } from './speech-router.service';

/**
 * Global como o AiModule: qualquer feature pode pedir voz sem reimportar a
 * infraestrutura, e nenhuma delas conhece o provider por tras.
 */
@Global()
@Module({
  providers: [MimoSpeechProvider, OpenAiSpeechProvider, ElevenLabsProvider, SpeechRouterService],
  exports: [SpeechRouterService],
})
export class SpeechModule {}
