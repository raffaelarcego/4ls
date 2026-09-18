import { useEffect, useRef } from 'react';

/**
 * Publica a altura de um elemento numa custom property do <html>.
 *
 * Existe porque duas barras fixas se empilham no pe da tela -- as abas do
 * Layout e o rodape da licao -- e o conteudo precisa reservar o espaco das
 * duas. Antes cada tela chutava um `pb-44`/`pb-32` fixo, e o chute errava
 * justamente no pior momento: o rodape cresce quando o resultado e longo
 * ("Resposta certa: <frase inteira>"), entao a correcao ficava escondida atras
 * dele e era preciso rolar para ler o proprio resultado.
 *
 * Medir em vez de chutar tambem resolve o rodape que ficava POR BAIXO das abas:
 * quem desenha cada barra publica a sua altura, e a outra se posiciona a partir
 * dela.
 */
export function useHeightVar<T extends HTMLElement>(name: string) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const publish = () => {
      // offsetHeight ja inclui o padding de safe-area, e vai a zero sozinho
      // quando a barra esta escondida por breakpoint (display:none no desktop).
      document.documentElement.style.setProperty(name, `${element.offsetHeight}px`);
    };

    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(element);

    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty(name);
    };
  }, [name]);

  return ref;
}
