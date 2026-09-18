/**
 * Barra de progresso chapada, sem brilho de capsula. `tone` recebe uma classe
 * de fundo (bg-grass, bg-macaw...) para que quem chama escolha a cor do
 * preenchimento sem precisar saber da estrutura interna.
 */
export function ProgressBar({
  value,
  max = 100,
  tone = 'bg-grass',
  size = 'md',
  trackClassName = 'bg-swan',
}: {
  value: number;
  max?: number;
  tone?: string;
  size?: 'sm' | 'md' | 'lg';
  trackClassName?: string;
}) {
  const percentage = max === 0 ? 0 : Math.min(100, Math.max(0, Math.round((value / max) * 100)));
  const height = size === 'lg' ? 'h-2.5' : size === 'sm' ? 'h-1.5' : 'h-2';

  return (
    <div
      className={`${height} w-full overflow-hidden rounded-sm ${trackClassName}`}
      role="progressbar"
      aria-valuenow={percentage}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-sm transition-[width] duration-500 ease-out ${tone}`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}
