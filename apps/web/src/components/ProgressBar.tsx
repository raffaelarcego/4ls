/**
 * Barra de progresso "gorda", com o brilho interno que da o aspecto de capsula.
 * `tone` recebe uma classe de fundo (bg-grass, bg-macaw...) para que quem chama
 * escolha a cor do preenchimento sem precisar saber da estrutura interna.
 */
export function ProgressBar({
  value,
  max = 100,
  tone = 'bg-grass',
  size = 'md',
  className = '',
}: {
  value: number;
  max?: number;
  tone?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const percentage = max === 0 ? 0 : Math.min(100, Math.max(0, Math.round((value / max) * 100)));
  const height = size === 'lg' ? 'h-4' : size === 'sm' ? 'h-2.5' : 'h-3.5';

  return (
    <div
      className={`${height} w-full overflow-hidden rounded-full bg-swan ${className}`}
      role="progressbar"
      aria-valuenow={percentage}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`relative h-full rounded-full transition-[width] duration-500 ease-out ${tone}`}
        style={{ width: `${percentage}%` }}
      >
        {percentage > 8 && (
          <span className="absolute inset-x-1.5 top-[3px] h-1 rounded-full bg-white/35" />
        )}
      </div>
    </div>
  );
}
