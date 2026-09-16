import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { CefrLevel } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { LoginDto, RegisterDto } from './auth.dto';

/**
 * Estado inicial dos 4 idiomas, conforme o perfil do produto.
 *
 * Exportado porque o cadastro nao e o unico lugar que precisa dele: quando um
 * idioma novo entra no produto, os usuarios que ja existiam tambem tem de ser
 * matriculados (ver prisma/enroll-languages.ts). Duas copias desta lista
 * divergiriam no primeiro idioma adicionado.
 */
export const DEFAULT_LANGUAGE_SETUP: Array<{
  code: string;
  currentLevel: CefrLevel;
  targetLevel: CefrLevel;
  priority: number;
}> = [
  { code: 'en', currentLevel: CefrLevel.B2, targetLevel: CefrLevel.C1, priority: 1 },
  { code: 'es', currentLevel: CefrLevel.A2, targetLevel: CefrLevel.B2, priority: 2 },
  { code: 'de', currentLevel: CefrLevel.A1, targetLevel: CefrLevel.B1, priority: 3 },
  { code: 'ru', currentLevel: CefrLevel.A1, targetLevel: CefrLevel.A2, priority: 4 },
];

/**
 * Minutos por idioma no cadastro.
 *
 * Com quatro idiomas, 20 minutos cada estouraria o dia padrao de 60. O valor
 * fecha exatamente o padrao do produto (4 x 15 = 60) -- o aluno redistribui
 * depois pela tela de idiomas, mas comeca com um dia que cabe no dia.
 */
export const DEFAULT_MINUTES_PER_LANGUAGE = 15;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Ja existe uma conta com este e-mail.');
    }

    const user = await this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        email,
        passwordHash: await bcrypt.hash(dto.password, 10),
        streak: { create: {} },
      },
    });

    // Matricula o usuario nos quatro idiomas com os niveis do perfil inicial.
    const languages = await this.prisma.language.findMany();
    const byCode = new Map(languages.map((l) => [l.code, l.id]));

    await this.prisma.userLanguage.createMany({
      data: DEFAULT_LANGUAGE_SETUP.filter((s) => byCode.has(s.code)).map((s) => ({
        userId: user.id,
        languageId: byCode.get(s.code)!,
        currentLevel: s.currentLevel,
        targetLevel: s.targetLevel,
        priority: s.priority,
        minutesPerDay: DEFAULT_MINUTES_PER_LANGUAGE,
      })),
    });

    await this.enrollSeedVocabulary(user.id);

    return this.sign(user.id, user.email, user.name);
  }

  /**
   * Da ao usuario novo o vocabulario semeado dos idiomas dele, com todos os
   * itens vencidos hoje. Sem isso a primeira sessao nao teria o que revisar.
   */
  private async enrollSeedVocabulary(userId: string) {
    const vocabulary = await this.prisma.vocabulary.findMany({
      where: { source: 'seed' },
      select: { id: true },
    });
    if (vocabulary.length === 0) return;

    await this.prisma.userVocabulary.createMany({
      data: vocabulary.map((v) => ({ userId, vocabularyId: v.id })),
      skipDuplicates: true,
    });
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('E-mail ou senha invalidos.');
    }
    return this.sign(user.id, user.email, user.name);
  }

  private sign(id: string, email: string, name: string) {
    return {
      accessToken: this.jwt.sign({ sub: id, email }),
      user: { id, email, name },
    };
  }
}
