import { Module } from '@nestjs/common';
import { PromotionController } from './promotion.controller';
import { PromotionService } from './promotion.service';

@Module({
  controllers: [PromotionController],
  providers: [PromotionService],
  // A gamificacao pergunta quantos chefes ele ja venceu, para a conquista.
  exports: [PromotionService],
})
export class PromotionModule {}
