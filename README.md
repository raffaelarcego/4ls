# Raffael 4L

Sistema operacional pessoal para aquisição de idiomas — inglês, espanhol, alemão e russo em 1 hora por dia.

O produto responde a uma única pergunta ao abrir: **"o que eu deveria estudar agora?"**. O dashboard já entrega a sessão pronta, montada a partir do seu desempenho.

## Como rodar

```bash
npm install
npm run db:migrate        # cria as tabelas
npm run db:seed           # idiomas, conquistas e conceitos iniciais
npm run dev               # sobe API (3333) e web (5173) juntos
npm test                  # testes dos motores (sem banco, sem rede)
```

Se voce ja usava o app antes dos conceitos, o vocabulario antigo ficou fora da
rede -- cada termo continua valendo como card, mas sozinho, que e justamente o
que os conceitos vieram corrigir. Para puxa-lo para dentro:

```bash
npm run db:backfill-concepts -- --dry-run   # mostra o plano, nao grava nada
npm run db:backfill-concepts                # liga, completa com IA e matricula
```

O backfill roda em tres fases: liga cada termo solto a um conceito pelo
significado em portugues (de graca), completa com IA so o que sobrou faltando e
matricula nos outros idiomas **apenas** quem ja tinha aquele conceito em algum
deles. Tem teto de 100 chamadas de IA por execucao (`--limit=N` muda), entao
rodar duas vezes e seguro e continua de onde parou.

### Manutencao

```bash
npm run content:warm -w @4l/api                  # prepara o conteudo de estudo antes da hora
npm run db:enroll-languages                      # matricula usuarios antigos num idioma novo
npm run db:merge-concepts -- <origem> <destino>   # funde dois conceitos que sao o mesmo significado
npm run db:rewind -- 1                           # empurra as sessoes um dia para tras (dev)
```

`content:warm` é o único que precisa rodar com alguma regularidade. As aulas de
estrutura, as can-dos e os **textos de leitura** não são gerados durante a
sessão: quatro idiomas numa resposta só levam minutos, e a função da Vercel
morre aos 60s — o aluno recebia "network error" no meio do estudo. A sessão só
lê conteúdo pronto, e quem paga o custo é este script, fora do horário de
estudo. É idempotente: rodar com tudo preparado não custa nenhuma chamada de IA.
Bloco cujo conteúdo ainda não foi preparado responde 503 dizendo exatamente
isso.

`db:enroll-languages` existe porque o cadastro matricula nos idiomas do momento e
nunca mais volta ao assunto: quando o russo entrou, quem ja tinha conta ficou sem
ele. `db:merge-concepts` resolve a colisao que o codigo deliberadamente nao
resolve sozinho -- quando a IA gera para um conceito um termo que ja e de outro,
os dois quase sempre sao o mesmo significado, mas "pasta" de arquivo e "pasta" de
comer provam que nem sempre. Quem decide e uma pessoa olhando.

Abra http://localhost:5173 e crie uma conta. Ela já nasce com os quatro idiomas configurados (inglês B2, espanhol A2, alemão A1, russo A1) e 22 conceitos — 88 termos — prontos para revisar.

### Pré-requisitos

- Node 20+
- Um PostgreSQL (o projeto está apontado para o **Neon**)

## Banco de dados (Neon)

O banco já está migrado e semeado no Neon. A conexão fica em `apps/api/.env` e usa **duas** URLs:

```env
DATABASE_URL="...-pooler...?sslmode=require&channel_binding=require&pgbouncer=true"
DIRECT_DATABASE_URL="..."   # mesma URL, sem o "-pooler"
```

Isso não é redundância. O Neon serve duas portas: a com pooler (PgBouncer), que aguenta muitas conexões curtas e é o que a aplicação usa em runtime; e a direta, que o Prisma Migrate exige, porque o PgBouncer não suporta os comandos de DDL em sessão que as migrations emitem. O `schema.prisma` declara as duas em `datasource db`. Se você trocar de projeto no Neon, atualize as duas — a direta é sempre a mesma string sem o sufixo `-pooler` no host.

O flag `pgbouncer=true` na URL de runtime desliga os prepared statements do Prisma, que o pooler em modo transação não consegue manter entre requisições.

> O plano free do Neon suspende o banco depois de alguns minutos ocioso. A primeira requisição depois de uma pausa leva alguns segundos a mais — é o banco acordando, não um bug.

## Configurar a IA

Ambas as chaves já estão em `apps/api/.env` e foram testadas contra as APIs reais.

```env
AI_PROVIDER_ORDER="mimo,openrouter"        # tarefas complexas
AI_FAST_PROVIDER_ORDER="openrouter,mimo"   # tarefas simples/interativas
```

São **duas cadeias**, não uma. Tarefas complexas (avaliação de escrita e speaking, planejamento da sessão, análise de erros) vão para o modelo forte; tarefas interativas (conversa do tutor, correção curta, tradução, classificação) vão para o rápido e barato. Isso importa na prática: com tudo passando pelo `mimo-v2.5-pro`, a resposta do tutor levava ~16s; roteada para o `gpt-4o-mini`, caiu para ~2,5s.

Dentro de cada cadeia vale o fallback: se o primeiro provider falhar, o próximo assume; se todos falharem, a requisição retorna 503 com a lista de erros. Se a cadeia preferida não tiver nenhum provider configurado, ela cai automaticamente na outra — ou seja, com uma única chave o sistema funciona inteiro.

Sem chave nenhuma o sistema continua funcionando — só o tutor, a geração de exercícios e o Writing Lab ficam indisponíveis, e o dashboard avisa isso explicitamente. Essa é a regra do projeto: **a plataforma nasce funcional antes de nascer inteligente.**

Toda chamada — inclusive as que falham — é registrada em `ai_call_logs` e aparece em **Progresso → Uso de IA**, com tokens, latência e custo estimado por modelo.

## Configurar a voz

O sistema fala. E, se a chave da MiMo já está preenchida, **ele já fala com voz natural — sem configurar mais nada**, porque a mesma chave que atende o texto atende o áudio.

```env
SPEECH_PROVIDER_ORDER="mimo,openai,elevenlabs"
```

### MiMo

A MiMo **não** expõe `/audio/speech` como a OpenAI. TTS e ASR passam pelo próprio `/chat/completions`, e o formato tem uma inversão que custa tempo descobrir: o texto a ser falado vai na mensagem **`assistant`**, e a mensagem **`user`** carrega a instrução de estilo em linguagem natural. Mandar o texto no `user` responde `messages must contain an assistant role for TTS model`.

Vozes por idioma em `MIMO_VOICE_EN/ES/DE/RU` (Mia, Chloe, Milo, Dean, Emma, além das chinesas). Timbres distintos ajudam a não confundir os quatro cursos.

O áudio volta em **WAV**, sem opção comprimida — cerca de 150–180 KB por frase curta. Como cada frase é sintetizada uma única vez e fica em cache, o custo é de armazenamento, não de repetição; **Progresso → Cache de voz** mostra quanto já foi guardado.

### O ASR da MiMo vem desligado

`MIMO_ASR_LANGUAGES` é vazio por padrão. São dois motivos medidos, não suposição:

- **Fora do inglês a transcrição sai corrompida.** Uma frase alemã limpa (`Guten Morgen! Wie geht es dir heute?`) voltou como `But, Margen, we get es今他` — inglês e chinês misturados. Em inglês a mesma prova saiu perfeita.
- **O navegador grava em webm/opus**, que a MiMo não aceita.

Alimentar o Speaking Lab com uma transcrição corrompida seria pior que não ter transcrição: o aluno receberia correção sobre um texto que nunca disse. Com a lista vazia, `/speech/status` responde `stt: false` e o front usa o reconhecimento do próprio navegador.

Para transcrição de verdade nos quatro idiomas, configure `SPEECH_API_KEY` (Whisper ou compatível). Para habilitar a MiMo só em inglês e com áudio wav: `MIMO_ASR_LANGUAGES="en"`.

### Sem chave nenhuma

O front cai na `speechSynthesis` do navegador para ouvir, e no reconhecimento de fala do navegador (Chrome/Edge) para falar. Funciona, é grátis e não depende de nada — só soa sintético. Preencher uma chave **troca a qualidade, não habilita a funcionalidade**.

### O cache é o ponto todo

Todo áudio sintetizado é guardado em `speech_clips` com **o hash do texto** como chave — não o id do termo. A mesma frase no mesmo idioma custa **uma única sintetização para sempre**, venha ela do flashcard, do ditado ou de um diálogo de listening. Como conteúdo de estudo se repete por definição (é disso que vive a repetição espaçada), na prática só a primeira exposição de cada frase é paga.

Só que o cache de áudio depende do texto repetir — e é aí que estava o furo. Cada bloco de escuta gerava um diálogo novo, então o texto **nunca** repetia e o conteúdo mais caro do sistema pagava síntese toda vez. Por isso os diálogos também são guardados, em `listening_dialogues`, num pool por idioma e nível: as primeiras 8 escutas de cada nível geram conteúdo novo — o que garante variedade — e a partir daí o bloco reaproveita o menos usado recentemente. Como o texto já é conhecido, o áudio já está em cache, e a escuta fica de graça.

`POST /tutor/listening` com `{"fresh": true}` força conteúdo novo, ignorando o pool.

**Progresso → Cache de voz** mostra quantas frases estão guardadas, quantas reproduções já aconteceram e quantas sintetizações isso evitou.

## Deploy na Vercel

São **dois projetos**, apontando para o mesmo repositório, cada um com sua *Root Directory*:

| Projeto | Root Directory | Config | Vira |
|---|---|---|---|
| API | `apps/api` | `apps/api/vercel.json` | https://4ls-api.vercel.app |
| Site | `apps/web` | `apps/web/vercel.json` | o site |

Na tela de import da Vercel, o Root Directory é o campo que decide tudo: importar a raiz do repo não funciona aqui, e importar a pasta errada publica metade do sistema sem erro nenhum — a API sozinha responde bonito e o site nunca aparece.

Os dois `package.json` têm um script **`vercel-build`**. A Vercel procura por ele antes do `build`, e tê-lo deixa o deploy imune a um *Build Command* sobrescrito no painel apontando para esse nome — que foi exatamente o que quebrou o primeiro deploy do site (`Missing script: "vercel-build"`). Se o painel tiver um Build Command customizado que você não reconhece, o normal é deixá-lo em branco e confiar no `vercel.json`.

### Variáveis (só no projeto da API)

Settings → Environment Variables. O `.env` é local e está fora do git:

```
DATABASE_URL           a URL com -pooler do Neon (com pgbouncer=true)
DIRECT_DATABASE_URL    a mesma, sem o -pooler
JWT_SECRET             um segredo longo e aleatório
```

**`CORS_ORIGINS` pode ficar em branco.** Vazia, a API libera `localhost` e qualquer `*.vercel.app` — o que já cobre o site. Definindo, ela passa a valer *exatamente*, e é o que você deve fazer quando o site tiver domínio próprio.

Dois erros que essa variável já causou aqui e não dão nenhuma pista no log da API, porque quem bloqueia é o navegador:

- apontar para a URL **da API** em vez da do site — o `Origin` que chega é sempre o do site, então nada casa;
- colar **com aspas** do `.env.example`: no painel da Vercel o valor é literal, e `"https://site.com"` guarda as aspas dentro da string. O código normaliza aspas e barra final, mas evite.

> Mudar variável na Vercel não aplica sozinho: precisa de um *Redeploy*.

O site não precisa de variável: a URL da API está versionada em `apps/web/.env.production`. Definir `VITE_API_URL` no painel sobrescreve, útil para apontar um preview para outra API.

As chaves de IA e de voz são opcionais. Sem elas o sistema sobe funcional — só sem tutor, sem exercícios gerados e com a voz do navegador.

### Como a API roda em serverless

Numa função não existe processo escutando porta, então há dois pontos de entrada: `src/main.ts` (local, `app.listen`) e `src/serverless.ts` (Vercel, `app.init` + handler). Os dois aplicam a mesma configuração, que mora em `src/bootstrap.ts` — prefixo, CORS, pipes e limite de corpo num lugar só, para os ambientes não divergirem.

A aplicação Nest fica **em cache no escopo do módulo**. Sem isso cada requisição reconstruiria o container e abriria conexão nova no banco, estourando o pool do Neon em poucos acessos simultâneos. Um cold start que falha limpa o cache, para a invocação seguinte poder tentar de novo.

O `api/index.js` é JavaScript puro de propósito: o builder da Vercel compila a pasta `api/` com esbuild, que **não** emite `emitDecoratorMetadata` — e sem esses metadados a injeção de dependência do Nest quebra. O TypeScript é compilado antes pelo `nest build` (tsc, que emite) e a função só carrega o resultado.

A raiz do domínio da API serve `public/index.html`, uma página estática. Ela existe porque a Vercel exige um diretório de saída quando há `buildCommand` próprio — já que era obrigatório, melhor mostrar algo útil que um erro.

### Armadilhas que o código já trata

- **Banco dormindo no cold start.** O Neon free hiberna quando ocioso. O `$connect()` na subida **não** derruba mais a aplicação: o Prisma reconecta na primeira query, e enquanto isso `/api/health` consegue dizer que o problema é o banco — antes, o init inteiro abortava e *todas* as rotas respondiam 500, inclusive as que nem tocam no banco.
- **Engine do Prisma.** `binaryTargets = ["native", "rhel-openssl-3.0.x"]`. Sem o alvo Linux o build passa e *toda query falha em produção*.
- **Corpo de 4.5 MB.** O áudio do Speaking Lab vai em base64, então o teto é 3 MB de áudio (~4 MB codificado). O gravador para sozinho em 90 s, o que dá ~1,5 MB.
- **Duração da função.** `maxDuration: 60`. O padrão de 10 s cortaria no meio uma avaliação de fala ou escrita no modelo forte, que leva ~16 s.

### Migrations

O deploy **não** roda migration — o build só gera o client e compila. Rodar `migrate deploy` no build deixaria um erro de banco derrubar o deploy inteiro, e builds concorrentes brigariam pela mesma trava. Depois de mudar o schema, aplique antes de publicar:

```bash
npm run db:migrate
```

## Arquitetura

```
apps/
├── api/                      NestJS + Prisma + PostgreSQL
│   ├── prisma/               schema e seed
│   └── src/
│       ├── infrastructure/
│       │   ├── ai/           AI Gateway: providers, router, prompts versionados
│       │   └── database/
│       └── modules/          auth, languages, concepts, structure, vocabulary,
│                             review, errors, gamification, study, grammar,
│                             tutor, speech, dashboard, analytics
└── web/                      React + TypeScript + Tailwind + TanStack Query + Zustand
```

### Os motores que importam

**Concept Engine** (`apps/api/src/modules/concepts/concepts.service.ts`)
A unidade de aprendizado não é a palavra, é o **conceito**: um significado em português que existe nos quatro idiomas ao mesmo tempo. "trabalho" entra na sessão uma vez e chega como `work`, `el trabajo`, `die Arbeit` e `работа` no mesmo dia.

Isso não é organização de banco, é a tese de aprendizado do produto: a memória de uma língua sustenta a das outras quando as quatro palavras entram penduradas no mesmo gancho. Aprender `Arbeit` isolado, três semanas depois de `work`, é aprender duas coisas; aprender as quatro juntas é aprender uma.

Toda porta de entrada de vocabulário passa por aqui — palavra salva à mão, termo vindo do listening, sugestão do tutor. O serviço acha ou cria o conceito, **completa** com IA o que falta nos outros idiomas e só então matricula o aluno, nos quatro de uma vez. Conceito incompleto não vira aula do dia: degradar é melhor que travar, mas nunca em silêncio.

**Sentence Structure Engine** (`apps/api/src/modules/structure/`)
Saber o que `Arbeit` significa não ensina a dizer "amanhã de manhã eu vou para o trabalho de ônibus". Cada idioma monta a frase com uma ordem, uma marcação e umas obrigações próprias — e sem isso o aluno junta palavras certas numa frase que nenhum nativo diria.

O catálogo de padrões (`sentence-patterns.catalog.ts`) é **curado**, pela mesma razão do catálogo de contrastes: uma regra de ordem de palavras errada é pior que nenhuma, porque o aluno a aplica em tudo que fala. A IA escreve as frases, desmonta os exemplos em constituintes rotulados e cria os exercícios **em cima** do mapa, nunca o mapa. Cada aula guarda `formula`, passos de montagem, exemplos fatiados peça a peça, armadilhas de interferência do português e exercícios de ordenação — e vai para um pool por (idioma, nível, padrão), então o custo de IA vai a zero depois que ele enche.

O padrão escolhido é o de menor domínio para o nível do aluno, não rotação cega: se a ordem do verbo alemão ainda não firmou, ela volta.

**Reading Engine** (`apps/api/src/modules/reading/`)
O bloco de leitura existia no planejador desde o início e não tinha texto nenhum: caía nos exercícios gerados, e "compreensão de texto" sem texto é um quiz com outro nome.

O que entrou não é *um texto por idioma*, é **o mesmo texto**. O catálogo (`reading.catalog.ts`) é curado e guarda a premissa em português — a história inteira, com começo, meio e fim. É ela que amarra as quatro versões: sem premissa fixa, cada geração conta uma história parecida e a comparação morre. A IA escreve as quatro numa chamada só, cada uma no nível *daquele* idioma. O que varia por idioma é o tamanho da frase; a história, os fatos e a ordem são idênticos.

Daí saem duas coisas que nenhuma leitura isolada dá:

- **Andaime.** Ele lê primeiro no idioma mais forte. Quando o texto volta em russo, ele já sabe o que está escrito ali — e ler sabendo o conteúdo é o que permite ler acima do próprio nível sem travar na terceira linha. A tela diz isso no topo: "você já leu esta história em inglês".
- **Contraste frase a frase.** As versões são alinhadas por **índice**: a frase 3 do alemão diz o que diz a frase 3 do inglês. Tocar numa frase abre a mesma frase nos outros três idiomas — o contraste no ponto exato em que a dúvida apareceu.

Por isso a validação mais severa do módulo é o alinhamento (`alignedPassage`), e não a qualidade do texto. Uma versão que juntou duas frases numa desalinha tudo dali para a frente **com aparência de certo**: a tela continua mostrando quatro frases lado a lado, só que elas param de dizer a mesma coisa. Texto desalinhado é descartado inteiro.

A escolha do texto do dia inverte a regra dos outros blocos: em vez do assunto menos dominado, vem a história que ele **já leu em outro idioma e ainda não leu neste** — é a segunda leitura que dá o andaime. As perguntas de compreensão são por idioma e de **detalhe**, nunca de ideia geral: na terceira leitura ele já sabe a história e acertaria de memória, sem ler uma linha.

**CEFR Engine / chefe de fase** (`apps/api/src/modules/promotion/`)
O CEFR era meio motor: as subcompetências eram rastreadas, a nota composta calculada, `suggestedLevel` dizia "dá para subir" — e nada acontecia. Como o nível é o teto de todo o conteúdo (can-do, leitura, estrutura), o idioma ficava preso onde começou, por construção.

Havia dois jeitos de fechar isso. Promover sozinho quando a composta passa de 85 é o fácil, e promove a partir da **opinião do aluno**: metade das notas de competência vem de autoavaliação de fim de bloco. Subir de nível assim endurece o conteúdo com base em "achei que fui bem", e o engano só aparece três semanas depois.

Então a nota composta deixou de promover e passou a fazer outra coisa: **abrir o chefe**. Quem promove é um exame com gabarito, sem IA — pelo mesmo motivo da prova mensal: uma nota dada por modelo varia entre execuções, e o que decide subir de nível não pode variar.

Três rodadas, todas montadas do que ele **já estudou** naquele idioma: montar frases das can-dos, responder detalhes dos textos que leu, e reconhecer palavras que deu por aprendidas. Passa com 80% no conjunto **e** no mínimo 60% em cada rodada — o piso por rodada existe para impedir a aprovação torta, subir de nível acertando tudo de vocabulário e quase nada de montagem de frase.

Duas consequências que o módulo trata e são fáceis de esquecer:

- **Vencer encolhe as competências** (×0,6). Não é punição, é mudança de régua: 85 de gramática em A1 não é 85 em A2. Sem isso, a composta continuaria acima do portão e o chefe seguinte abriria no dia seguinte — A1 a B1 numa semana.
- **Perder fecha o chefe por uma semana**, e o resultado diz **qual rodada afundou**. Sem espera, o exame vira tentativa e erro; sem apontar a rodada, "não passou" não ensina nada.

O bloco nunca é planejado pelo Daily Mission Engine: ele aparece no painel quando o portão abre, e quem decide encarar é o aluno.

**Daily Mission Engine** (`apps/api/src/modules/study/mission.engine.ts`)
Planejador determinístico e auditável. Cada tipo de atividade recebe uma pontuação de necessidade a partir de três forças: fraqueza da competência, erros recorrentes abertos e variedade em relação às sessões recentes. Revisão vencida sempre vem primeiro. É isso que permite responder *por que* cada bloco foi recomendado — o motivo aparece na tela.

Dois blocos **não** passam pela pontuação: `structure` e `vocabulary` entram em todo idioma, todo dia. Não são os mais "necessários" pelo score — são os dois que sustentam a promessa do produto (o mesmo conceito nos quatro idiomas, e a regra de frase de cada um), e por isso não competem por vaga. O planejador reserva o tempo deles antes de distribuir o resto, para que uma revisão acumulada não engula a aula do dia.

A IA é refinamento **opcional** por cima disso (`?ai=true`). Se o plano da IA perder um idioma, remover um dos blocos obrigatórios ou estourar o tempo, ele é rejeitado e o plano determinístico prevalece.

**Spaced Repetition Engine** (`apps/api/src/modules/review/srs.engine.ts`)
Derivado do SM-2, mas ancorado na escada 1-3-7-14-30-60 dias definida no produto; o ease factor apenas estica ou encolhe essa escada. Intervalos ficam previsíveis e legíveis, sem abrir mão da adaptação por item.

Acima dele existe uma segunda camada, no nível do **conceito** (`concept_progress`). O SRS por card não consegue distinguir duas falhas opostas: "não sei o que isso significa" e "sei o significado, não consigo puxar a forma russa". A primeira pede reensinar o conceito; a segunda pede só treino de recuperação naquele idioma, e reapresentar o significado ali é desperdício.

`meaningStrength` mede o conceito através de todos os idiomas e é o que autoriza o **andaime**: quando o significado já firmou em outro idioma e a forma deste não, a revisão oferece a palavra que você já domina como dica. Ela fica atrás de um botão de propósito — dica dada cedo demais rouba o esforço de recuperação, que é justamente o que consolida.

**Produção quádrupla** (`POST /concepts/production/evaluate`)
Todo o resto do produto é reconhecimento: escolher alternativa, ordenar peças dadas. Reconhecimento esconde exatamente o que falha na hora de falar — puxar a forma da memória sem nada na tela. Aqui você escreve a mesma frase nos quatro idiomas, sem alternativas.

As quatro vão para a IA numa **única** chamada, e isso não é economia de token: é o que permite ver o que nenhuma avaliação isolada veria — a frase alemã saindo com a ordem russa, a espanhola copiando a estrutura inglesa. Avaliadas em separado, cada uma seria "erro de ordem das palavras" e a causa se perderia. Entra uma vez por semana, não todo dia: os conceitos precisam assentar entre uma produção e a seguinte.

**Error Intelligence** (`apps/api/src/modules/errors/errors.service.ts`)
Erros iguais não criam linhas novas — incrementam `occurrenceCount`. É isso que revela padrões ("ordem das palavras: 8 ocorrências") e realimenta o Daily Mission Engine, fechando o ciclo: erro → dado → nova atividade.

Desde a entrada do russo, cada erro guarda também a **origem da interferência** (`sourceLanguageId`): de qual dos outros idiomas ele veio. É o dado que só este produto consegue produzir, porque só ele sabe quais são os seus outros três idiomas — quem estuda quatro línguas quase nunca erra por ignorância, erra por importar a regra da vizinha.

Isso fecha um ciclo que antes parava no meio: o erro aponta o par de idiomas, `suggestedTopics` acha no catálogo de contrastes os pontos em que esses dois **divergem**, e a tela de Estruturas mostra o que estudar. "8 erros de ordem das palavras" virou "o russo está entrando no seu alemão, e é este tópico que resolve". A extração é conservadora por instrução explícita no prompt: um palpite de origem é pior que origem nenhuma, porque mandaria você estudar um contraste que nunca te atrapalhou.

A deduplicação usa a **categoria** como chave, não o texto da descrição. O motivo é concreto: o modelo reformula a descrição a cada chamada, então casar por string criaria uma linha nova toda vez e a contagem nunca acumularia. A categoria é um enum fixo e é exatamente a unidade que o dashboard e o motor adaptativo consomem. Erros de vocabulário são a exceção — ali a palavra específica importa, então casam por termo.

**Speech Gateway** (`apps/api/src/infrastructure/speech/`)
Mesmo desenho do AI Gateway, para voz: nenhum módulo fala com OpenAI ou ElevenLabs diretamente, a cadeia tem fallback e toda chamada vira linha em `ai_call_logs` (com tokens zerados — voz não gasta token; o que importa comparar ali é custo e latência). O cache por hash de texto é o que torna a voz natural viável: o conteúdo de estudo se repete, então o custo não acompanha o uso.

**AI Gateway** (`apps/api/src/infrastructure/ai/`)
Nenhum módulo fala com MiMo ou OpenRouter diretamente. Tarefas complexas (avaliação de speaking, planejamento, análise de erros, correção de escrita) vão para o modelo forte; o resto usa o rápido. Todos os prompts vivem em `prompts/index.ts`, versionados, nunca inline nos services.

## O que já funciona

- Autenticação JWT, com matrícula automática nos 4 idiomas e conceitos iniciais
- Dashboard com sessão pronta, streak, XP, competências CEFR e erros recorrentes por idioma
- Sessão de estudo com cronômetro, flashcards SRS, exercícios gerados por IA e blocos autoavaliados
- **Conceitos nos quatro idiomas de uma vez** — o bloco de vocabulário mostra o mesmo significado em inglês, espanhol, alemão e russo lado a lado, e o teste é cruzado entre idiomas de propósito
- **Andaime na revisão** — quando o significado já firmou em outro idioma, o card fraco oferece a palavra que você domina como dica, em vez de reensinar o conceito do zero
- **Produção quádrupla semanal** — escrever a mesma frase nos quatro idiomas, sem alternativas, com a correção olhando as quatro juntas
- **Interferência com culpado nomeado** — o erro registra de qual idioma veio, e a tela de Estruturas mostra o contraste que resolve aquele par
- **Chefe de fase** — o exame que sobe o idioma de nível: abre quando o desempenho chega lá, cobra três rodadas com gabarito e, se você passar, todo o conteúdo daquele idioma sobe junto
- **Leitura paralela** — a MESMA história lida nos quatro idiomas, alinhada frase a frase: tocar numa frase mostra o que ela diz e como ela fica nos outros três
- **Captura de texto** — cole um artigo e o vocabulário dele entra como conceito, já nos quatro idiomas
- **Formação de frase por idioma** — bloco diário com a fórmula, os passos de montagem, exemplos fatiados em constituintes rotulados e exercícios de ordenação
- Vocabulário em contexto (exemplo + tradução do exemplo, nunca "palavra = tradução")
- **Áudio em toda parte**: botão de ouvir no flashcard, no vocabulário, no enunciado do exercício e na fala do tutor
- **Listening com conteúdo próprio** — diálogo gerado no seu nível, falado em voz alta, com perguntas de compreensão que dão nota objetiva
- **Ditado** — o app fala, você escreve, e a correção é palavra a palavra
- **Speaking Lab** — grava, transcreve, avalia gramática/vocabulário/fluência e joga os erros no Error Intelligence
- AI Tutor por idioma, que corrige e alimenta o Error Intelligence automaticamente
- Writing Lab (`POST /tutor/writing`) com notas por dimensão e extração de erros
- Gamificação: XP por tipo de atividade, streak com virada de dia correta, 7 conquistas
- Analytics: tempo por idioma, consistência, Weekly Review com recomendação, custo de IA por modelo
- **Prática livre** — o planejador continua mandando no que você *deveria* fazer, mas você pode pedir um bloco específico e ele entra na sessão de hoje valendo XP igual
- **Instalável como app** (PWA) — manifest, service worker e um guia de instalação por plataforma, alcançável a qualquer momento pelo botão 📲 no cabeçalho
- Testes dos motores (`npm test`): escada do SRS, ranking do planejador, deduplicação de erros e o parser de resposta da IA

## O que ainda não existe

Estes itens da especificação ficaram fora desta entrega:

- **Avaliação de pronúncia** — o Speaking Lab avalia o que a transcrição revela (gramática, vocabulário, fluência, cumprimento da missão). Pronúncia em si exige análise do áudio, não do texto, e não está feita — o prompt é explícito em tratar qualquer suspeita de pronúncia como hipótese.
- Notificações, A/B testing, biblioteca de conteúdo (MVP 5).

## Instalar no celular

O 4L é um site que se instala como aplicativo — não há loja nem build nativo. O botão **📲 Instalar** fica no cabeçalho e some sozinho depois que o app está instalado.

Onde isso costuma falhar, e o que o guia responde:

- **Navegador dentro de outro app** (Instagram, WhatsApp, LinkedIn). É a causa mais comum e a mais invisível: o webview não instala nada, e nada na tela denuncia que você não está no Chrome. O guia detecta pelo user agent e oferece o endereço para copiar.
- **iPhone.** O iOS nunca dispara `beforeinstallprompt`: não existe botão, o caminho é Compartilhar → Adicionar à Tela de Início, e só no Safari — Chrome e Firefox no iPhone não conseguem.
- **Sem HTTPS.** Nenhum navegador instala, e nenhuma instrução de menu resolve.

O convite automático que aparece no rodapé pode ser adiado, não dispensado para sempre: "Agora não" o some por sete dias. A versão anterior gravava um booleano permanente, e um toque distraído apagava o único caminho de instalação que existia na interface.

## Endpoints principais

```
POST /api/auth/register | login          GET /api/auth/me
GET  /api/dashboard                      o painel completo, com a sessão do dia
GET  /api/study/today                    sessão de hoje (?ai=true para refinar com IA)
POST /api/study/practice                 adiciona um bloco escolhido por você
POST /api/study/activities/:id/complete
POST /api/study/sessions/:id/complete
GET  /api/review/due                     itens vencidos
POST /api/review/:id/grade               again | hard | good | easy
GET  /api/vocabulary                     POST /api/vocabulary
GET  /api/concepts/lesson                os conceitos de hoje, nos 4 idiomas
GET  /api/concepts/coverage              quantos já existem nos 4 idiomas
POST /api/concepts/learn                 aprende um termo — entra nos 4 de uma vez
GET  /api/structure/lesson               a aula de formação de frase do dia
POST /api/structure/record               resultado da rodada de montagem
GET  /api/promotion/status               o chefe de fase em cada idioma, e o que falta
GET  /api/promotion/exam                 o exame de um idioma (403 com o chefe fechado)
POST /api/promotion/attempt              o resultado — é ele que promove
GET  /api/reading/lesson                 o texto de hoje num idioma + as outras 3 versões
POST /api/reading/record                 resultado da compreensão, por texto e idioma
GET  /api/concepts/production/mission    o conceito da vez para produção livre
POST /api/concepts/production/evaluate   avalia as 4 frases juntas
POST /api/concepts/capture               extrai vocabulário de um texto colado
GET  /api/errors/interference            quais idiomas estão contaminando quais
POST /api/tutor/message                  conversa + correção estruturada
POST /api/tutor/exercises                exercícios mirando suas fraquezas
POST /api/tutor/writing                  Writing Lab
POST /api/tutor/listening                diálogo + perguntas de compreensão
POST /api/tutor/dictation                frases para ditado
POST /api/tutor/speaking/mission         o que falar
POST /api/tutor/speaking                 avalia a transcrição da fala
GET  /api/speech/status                  há provider de voz? de transcrição?
POST /api/speech/tts                     texto -> áudio (com cache por hash)
POST /api/speech/transcribe              áudio -> texto
GET  /api/speech/cache                   o que o cache já economizou
GET  /api/errors | /api/errors/by-category
GET  /api/analytics/time | consistency | weekly-review | ai-usage
GET  /api/achievements
GET  /api/health                         única rota sem autenticação: subiu? banco responde?
```

## Regra de ouro

Não entregar conteúdo. **Decidir qual conteúdo você precisa.**
"# 4ls" 
