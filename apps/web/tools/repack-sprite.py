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
    python tools/repack-sprite.py --polish-only <folha-ja-empacotada> [saida.png]

`--polish-only` pula a deteccao e o reempacotamento, e so limpa a matte. Use
quando a folha JA esta na grade certa: a deteccao de linhas depende de faixas
vazias entre as tiras, e numa folha empacotada as tiras se encostam -- rodar a
deteccao nela funde linhas e devolve uma grade errada.

A saida padrao e `public/hero-sprite.png`. Ao terminar, ele imprime os valores
de FRAME e GRID -- copie-os para o bloco de configuracao no topo de
`src/components/Hero.tsx`.

Requer Pillow:  pip install pillow
"""

from pathlib import Path
import sys

import numpy as np
from PIL import Image

DEFAULT_OUT = Path(__file__).resolve().parent.parent / 'public' / 'hero-sprite.png'

# Fundo DEFINITIVO: so o branco praticamente puro entra aqui.
STRICT = 250
# Fundo POSSIVEL: inclui os pixels de borda, que sao mistura de personagem com
# o branco de tras. E entre um limiar e o outro que mora a suavizacao.
LOOSE = 200


def flood(rgb, threshold):
    """Marca o branco CONECTADO A BORDA da imagem.

    Conectado a borda, e nao branco em qualquer lugar: os olhos do personagem
    sao brancos, e uma troca global de cor os furaria.
    """
    h, w, _ = rgb.shape
    whiteish = rgb.min(axis=2) >= threshold
    out = np.zeros((h, w), dtype=bool)

    stack = []
    for x in range(w):
        for y in (0, h - 1):
            if whiteish[y, x] and not out[y, x]:
                out[y, x] = True
                stack.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if whiteish[y, x] and not out[y, x]:
                out[y, x] = True
                stack.append((y, x))

    while stack:
        y, x = stack.pop()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and whiteish[ny, nx] and not out[ny, nx]:
                out[ny, nx] = True
                stack.append((ny, nx))
    return out


def cut_background(img):
    """Separa personagem de fundo PRESERVANDO a borda suavizada.

    A primeira versao disto usava um limiar so e devolvia mascara binaria:
    cada pixel virava 100% opaco ou 100% transparente. O resultado tinha
    silhueta serrilhada e, pior, um halo branco -- os pixels de borda que
    ficavam logo abaixo do limiar continuavam opacos e quase brancos, o que
    sobre o fundo escuro do app aparece como um contorno claro em volta do
    personagem inteiro.

    Aqui a borda e tratada como o que ela e: uma MISTURA. Cada pixel observado
    e `obs = a*F + (1-a)*branco`, onde F e a cor real do personagem. Estimando
    F a partir dos vizinhos que sao personagem certo, da para resolver `a` e
    recuperar F -- e a borda volta suave, sem branco grudado nela.
    """
    rgb = np.asarray(img.convert('RGB'), dtype=np.float64)
    h, w, _ = rgb.shape

    bg_strict = flood(rgb, STRICT)   # fundo certo
    bg_loose = flood(rgb, LOOSE)     # fundo + borda
    band = bg_loose & ~bg_strict     # so a borda
    solid = ~bg_loose                # personagem certo

    # Cor do personagem junto a borda: media dos vizinhos solidos, num raio
    # pequeno. Sem isso nao ha como separar "azul claro do personagem" de
    # "azul escuro misturado com muito branco".
    mask = solid.astype(np.float64)
    acc = rgb * mask[:, :, None]
    cnt = mask.copy()
    for _ in range(3):
        acc = (acc + np.roll(acc, 1, 0) + np.roll(acc, -1, 0)
               + np.roll(acc, 1, 1) + np.roll(acc, -1, 1))
        cnt = (cnt + np.roll(cnt, 1, 0) + np.roll(cnt, -1, 0)
               + np.roll(cnt, 1, 1) + np.roll(cnt, -1, 1))
    near = np.divide(acc, cnt[:, :, None], out=np.full_like(acc, 128.0),
                     where=cnt[:, :, None] > 0)

    alpha = np.zeros((h, w), dtype=np.float64)
    alpha[solid] = 1.0

    # a = (255 - obs) / (255 - F), pelo canal de maior contraste: um canal em
    # que o personagem tambem e quase branco nao informa nada sobre `a`.
    contrast = 255.0 - near
    obs_gap = 255.0 - rgb
    usable = contrast > 40
    with np.errstate(divide='ignore', invalid='ignore'):
        per_channel = np.where(usable, obs_gap / np.maximum(contrast, 1e-6), np.nan)
    est = np.nanmax(np.where(np.isnan(per_channel), -np.inf, per_channel), axis=2)
    est = np.where(np.isfinite(est), est, 0.0)
    alpha[band] = np.clip(est[band], 0.0, 1.0)

    # Recupera a cor sem o branco embutido (desfaz a composicao sobre branco).
    a3 = np.repeat(alpha[:, :, None], 3, axis=2)
    with np.errstate(divide='ignore', invalid='ignore'):
        unmixed = (rgb - 255.0 * (1.0 - a3)) / np.maximum(a3, 1e-6)
    color = np.where(a3 > 0.004, unmixed, near)
    color = np.clip(color, 0, 255)

    out = np.dstack([color, alpha * 255.0]).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')


def polish(img):
    """Tira o halo branco e devolve suavizacao a silhueta.

    Roda sempre, inclusive quando a folha de entrada JA vem com alfa -- e o
    caso quando se reprocessa uma folha que foi cortada com limiar binario.
    Dois defeitos tipicos desse corte, e o conserto de cada um:

    HALO. O corte binario deixa opacos os pixels de borda que eram mistura com
    o branco de tras. Sobre fundo escuro eles viram um contorno claro em volta
    do personagem. Aqui cada um desses pixels recebe a cor do vizinho solido
    mais proximo e um alfa proporcional a quanto ele era branco: quanto mais
    branco era, mais transparente fica.

    SERRILHADO. Mascara binaria nao tem meio-termo, entao a silhueta sobe em
    degraus de um pixel. Um desfoque muito leve SO NO CANAL ALFA recria a
    transicao, sem tocar na cor e sem borrar o desenho.
    """
    rgba = np.asarray(img.convert('RGBA'), dtype=np.float64)
    rgb, alpha = rgba[:, :, :3], rgba[:, :, 3] / 255.0

    opaque = alpha > 0.5
    whiteish = rgb.min(axis=2) >= 225
    # Borda: opaco, quase branco, e com vizinho transparente ao lado.
    empty = ~opaque
    touches_empty = (
        np.roll(empty, 1, 0) | np.roll(empty, -1, 0)
        | np.roll(empty, 1, 1) | np.roll(empty, -1, 1)
    )
    fringe = opaque & whiteish & touches_empty

    if fringe.any():
        # Cor de referencia: media dos vizinhos opacos que NAO sao quase-brancos.
        good = (opaque & ~whiteish).astype(np.float64)
        acc = rgb * good[:, :, None]
        cnt = good.copy()
        for _ in range(2):
            acc = (acc + np.roll(acc, 1, 0) + np.roll(acc, -1, 0)
                   + np.roll(acc, 1, 1) + np.roll(acc, -1, 1))
            cnt = (cnt + np.roll(cnt, 1, 0) + np.roll(cnt, -1, 0)
                   + np.roll(cnt, 1, 1) + np.roll(cnt, -1, 1))
        near = np.divide(acc, cnt[:, :, None], out=rgb.copy(),
                         where=cnt[:, :, None] > 0)

        # Quanto o pixel era branco -> quanto ele deve sumir.
        whiteness = np.clip((rgb.min(axis=2) - 225.0) / 30.0, 0.0, 1.0)
        alpha = np.where(fringe, alpha * (1.0 - whiteness), alpha)
        rgb = np.where(fringe[:, :, None], near, rgb)

    # Suavizacao da silhueta: media 3x3 com peso central, aplicada so onde ha
    # transicao. Raio maior comeria os dedos e o topo do cabelo.
    pad = np.pad(alpha, 1, mode='edge')
    neigh = sum(
        pad[1 + dy: 1 + dy + alpha.shape[0], 1 + dx: 1 + dx + alpha.shape[1]]
        for dy in (-1, 0, 1) for dx in (-1, 0, 1)
    )
    blurred = (neigh + alpha * 3.0) / 12.0
    edge = (blurred > 0.02) & (blurred < 0.98)
    alpha = np.where(edge, blurred, alpha)

    out = np.dstack([np.clip(rgb, 0, 255), np.clip(alpha, 0, 1) * 255.0])
    return Image.fromarray(out.astype(np.uint8), 'RGBA')


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 1

    args = sys.argv[1:]
    polish_only = '--polish-only' in args
    args = [a for a in args if a != '--polish-only']
    if not args:
        print(__doc__)
        return 1

    src = Path(args[0])
    out = Path(args[1]) if len(args) > 1 else DEFAULT_OUT
    if not src.exists():
        print(f'nao encontrei: {src}')
        return 1

    src_img = Image.open(src)
    print(f'origem: {src_img.size[0]}x{src_img.size[1]} ({src_img.mode})')

    # --- 1. Fundo -> transparente, preservando a borda suavizada ---
    #
    # Folha que ja chega com alfa (reprocessamento) pula o recorte: refazer a
    # inundacao sobre transparencia nao acharia branco nenhum para remover.
    has_alpha = src_img.mode in ('RGBA', 'LA') and         np.asarray(src_img.convert('RGBA'))[:, :, 3].min() == 0
    img = src_img.convert('RGBA') if has_alpha else cut_background(src_img)
    print('entrada ja tinha alfa' if has_alpha else 'fundo branco recortado')
    img = polish(img)

    if polish_only:
        out.parent.mkdir(parents=True, exist_ok=True)
        img.save(out)
        print(f'polido sem reempacotar: {out}')
        return 0

    w, h = img.size
    px = img.load()

    # "Vazio" tolera residuo: a borda suave deixa alfa de 1 ou 2 longe do
    # personagem, e exigir zero exato faria a deteccao de linhas e colunas
    # enxergar tudo como ocupado e devolver um quadro so, do tamanho da folha.
    FLOOR = 8

    def empty_row(y):
        return all(px[x, y][3] <= FLOOR for x in range(w))

    def empty_col(x, y0, y1):
        return all(px[x, y][3] <= FLOOR for y in range(y0, y1))

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
                if any(px[xx, yy][3] > FLOOR for xx in range(x0, x1)):
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
