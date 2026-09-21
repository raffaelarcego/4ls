/**
 * Preparo da foto antes de mandar para o servidor.
 *
 * Uma foto de celular tem entre 2 e 8 MB. O limite de corpo da API é 4 MB e o
 * da função na Vercel é 4,5 MB — e base64 ainda cresce o arquivo em um terço.
 * Então mandar a foto como ela sai da câmera falha na maioria das vezes, e
 * falha de um jeito que não diz o que aconteceu: "413" ou um erro de rede seco.
 *
 * Encolher também não é só sobre caber. Um modelo que lê texto em imagem não
 * enxerga melhor com 12 megapixels: ele redimensiona por dentro de qualquer
 * jeito, e a imagem grande só custa mais token e mais espera. O que importa
 * para leitura é o texto ter contraste e estar reto, não a foto ser enorme.
 */

/**
 * Maior lado da imagem enviada.
 *
 * 1600px mantém legível o texto pequeno de um cardápio fotografado de perto e
 * ainda cabe com folga no limite de corpo depois do base64.
 */
const MAX_EDGE = 1600;

/** Qualidade do JPEG. 0.8 é o ponto em que o artefato ainda não come letra. */
const QUALITY = 0.8;

export interface PreparedPhoto {
  /** Base64 puro, sem o prefixo `data:` — é o que a API espera. */
  data: string;
  mimeType: string;
  bytes: number;
}

/**
 * Lê o arquivo, reduz o maior lado e devolve JPEG em base64.
 *
 * Sai sempre como JPEG, mesmo quando entra PNG: foto de câmera não tem
 * transparência a preservar, e um PNG de 1600px pode ser várias vezes maior que
 * o JPEG equivalente sem nenhum ganho de leitura.
 */
export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  const bitmap = await loadImage(file);

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('Este navegador não conseguiu preparar a imagem.');

  context.drawImage(bitmap, 0, 0, width, height);
  if ('close' in bitmap) bitmap.close();

  const dataUrl = canvas.toDataURL('image/jpeg', QUALITY);
  const data = dataUrl.slice(dataUrl.indexOf(',') + 1);

  return {
    data,
    mimeType: 'image/jpeg',
    // Base64 carrega 4 caracteres a cada 3 bytes -- esta e a conta de volta.
    bytes: Math.round((data.length * 3) / 4),
  };
}

/**
 * Carrega o arquivo como imagem.
 *
 * `createImageBitmap` é o caminho rápido e respeita a orientação EXIF quando
 * pedimos — sem isso, foto tirada com o telefone deitado chega girada, e texto
 * girado não é lido. O `<img>` fica como plano B para navegadores que não têm.
 */
async function loadImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // Segue para o plano B.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Não consegui abrir esta imagem.'));
      image.src = url;
    });
  } finally {
    // O canvas já copiou os pixels; segurar a URL vazaria memória a cada foto.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
