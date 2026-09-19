"""
Transforma uma folha de sprites "de banco de imagens" numa folha utilizavel.

Arte pronta quase nunca vem no formato que um app precisa. A folha original
deste projeto tinha tres problemas, e este script resolve os tres:

1. SEM TRANSPARENCIA. O arquivo era WebP em modo RGB, com o fundo branco
   chapado. Sobre o tema escuro do app, cada quadro aparecia dentro de um
   retangulo branco.
2. QUADROS FORA DE GRADE. As poses estavam espalhadas com espacamento
   irregular, entao recortar por divisao simples (largura / colunas) cortava
   membro de personagem no meio.
3. PES DESALINHADOS. Cada pose tinha altura propria; sem alinhar, o personagem
   flutuava e afundava de um quadro para o outro.

A saida e um PNG com canal alfa, em grade uniforme, com todos os quadros
centrados na horizontal e encostados no chao.

Uso:
    python tools/repack-sprite.py <folha-de-origem> [saida.png]

A saida padrao e `public/hero-sprite.png`. Ao terminar, ele imprime os valores
de FRAME e GRID -- copie-os para o bloco de configuracao no topo de
`src/components/Hero.tsx`.

Requer Pillow:  pip install pillow
"""

from collections import deque
from pathlib import Path
import sys

from PIL import Image

DEFAULT_OUT = Path(__file__).resolve().parent.parent / 'public' / 'hero-sprite.png'

# Acima disto o pixel conta como fundo. Alto porque o fundo e branco puro e o
# contorno do personagem e preto -- nao ha meio-termo a preservar.
WHITE = 238


def is_bg(px):
    return px[0] >= WHITE and px[1] >= WHITE and px[2] >= WHITE


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 1

    src = Path(sys.argv[1])
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_OUT
    if not src.exists():
        print(f'nao encontrei: {src}')
        return 1

    img = Image.open(src).convert('RGBA')
    w, h = img.size
    px = img.load()
    print(f'origem: {w}x{h}')

    # --- 1. Fundo -> transparente, por inundacao a partir das bordas ---
    #
    # Inundacao, e nao troca global de branco: os OLHOS do personagem sao
    # brancos, e um color-key global os furaria. So o branco CONECTADO a borda
    # da imagem e fundo.
    bg = [[False] * w for _ in range(h)]
    q = deque()

    def seed(x, y):
        if is_bg(px[x, y]) and not bg[y][x]:
            bg[y][x] = True
            q.append((x, y))

    for x in range(w):
        seed(x, 0)
        seed(x, h - 1)
    for y in range(h):
        seed(0, y)
        seed(w - 1, y)

    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and not bg[ny][nx] and is_bg(px[nx, ny]):
                bg[ny][nx] = True
                q.append((nx, ny))

    for y in range(h):
        for x in range(w):
            if bg[y][x]:
                px[x, y] = (255, 255, 255, 0)

    def empty_row(y):
        return all(px[x, y][3] == 0 for x in range(w))

    def empty_col(x, y0, y1):
        return all(px[x, y][3] == 0 for y in range(y0, y1))

    # --- 2. Faixas de linha: bandas horizontais vazias separam as tiras ---
    rows = []
    y = 0
    while y < h:
        if not empty_row(y):
            start = y
            while y < h and not empty_row(y):
                y += 1
            rows.append((start, y))
        else:
            y += 1
    print(f'linhas encontradas: {len(rows)} -> {rows}')

    # --- 3. Dentro de cada linha, as colunas ---
    boxes = []
    for (y0, y1) in rows:
        cols = []
        x = 0
        while x < w:
            if not empty_col(x, y0, y1):
                start = x
                while x < w and not empty_col(x, y0, y1):
                    x += 1
                cols.append((start, x))
            else:
                x += 1

        tight = []
        for (x0, x1) in cols:
            # Aperta tambem na vertical: cada pose tem altura propria.
            top, bottom = y1, y0
            for yy in range(y0, y1):
                if any(px[xx, yy][3] != 0 for xx in range(x0, x1)):
                    top = min(top, yy)
                    bottom = max(bottom, yy + 1)
            tight.append((x0, top, x1, bottom))
        boxes.append(tight)
        print(f'  linha {len(boxes)}: {len(tight)} quadros')

    # A celula e o maior quadro, mais uma folga de 2px: sem ela, a suavizacao
    # do redimensionamento no navegador puxa um pixel do quadro vizinho para
    # dentro do quadro atual, e aparece uma listra na borda.
    cell_w = max(b[2] - b[0] for row in boxes for b in row) + 2
    cell_h = max(b[3] - b[1] for row in boxes for b in row) + 2
    cols_max = max(len(row) for row in boxes)
    print(f'celula: {cell_w}x{cell_h} | grade: {cols_max}x{len(boxes)}')

    # --- 4. Reempacotar em grade uniforme, pe no chao ---
    sheet = Image.new('RGBA', (cols_max * cell_w, len(boxes) * cell_h), (0, 0, 0, 0))
    for r, row in enumerate(boxes):
        for c, (x0, y0, x1, y1) in enumerate(row):
            sprite = img.crop((x0, y0, x1, y1))
            # Centrado na horizontal, encostado embaixo: e este alinhamento que
            # faz o personagem pisar no chao em vez de flutuar entre quadros.
            dx = c * cell_w + (cell_w - (x1 - x0)) // 2
            dy = r * cell_h + (cell_h - (y1 - y0)) - 1
            sheet.paste(sprite, (dx, dy), sprite)

    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out)

    print(f'\ngravado: {out}')
    print('--- copie para src/components/Hero.tsx ---')
    print(f'const GRID  = {{ cols: {cols_max}, rows: {len(boxes)} }};')
    print(f'const FRAME = {{ w: {cell_w}, h: {cell_h} }};')
    print('quadros por linha:', [len(r) for r in boxes])
    return 0


if __name__ == '__main__':
    sys.exit(main())
