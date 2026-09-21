import { NavLink, Outlet } from 'react-router-dom';

/**
 * A Base: tudo que não é a missão do dia.
 *
 * O rodapé tinha seis abas e não cabia mais nada -- "Estruturas" e "Progresso"
 * já ocupavam quase a célula inteira num aparelho de 360px, e a sétima
 * quebraria a barra em duas linhas.
 *
 * O agrupamento não é só economia de espaço, e é isso que faz o nome pegar:
 * consulta, tutor e progresso são as três coisas que o aluno faz ENTRE as
 * missões, não durante. Num acampamento-base você olha o mapa, conversa com o
 * guia e confere o quanto já andou -- e é exatamente isso.
 *
 * As rotas antigas continuam existindo e redirecionam para cá: qualquer atalho
 * que ele já tenha salvo na tela inicial do celular continua funcionando.
 */

const SECTIONS = [
  { to: 'consulta', label: 'Consulta', blurb: 'As tabelas' },
  { to: 'tutor', label: 'Tutor', blurb: 'Conversa corrigida' },
  { to: 'progresso', label: 'Progresso', blurb: 'O quanto andou' },
];

export function BasePage() {
  return (
    <div className="space-y-5">
      {/*
        Chips compactos, e não títulos grandes: eles precisam ler como
        NAVEGAÇÃO. Cada página abaixo mantém o próprio `h1`, e dois títulos do
        mesmo tamanho na mesma tela competem em vez de se complementarem.
      */}
      <nav className="hscroll -mx-4 flex gap-2 px-4 pb-1">
        {SECTIONS.map((section) => (
          <NavLink
            key={section.to}
            to={section.to}
            className={({ isActive }) =>
              `tap-target flex shrink-0 items-center rounded-full border px-4 py-2 text-sm font-bold transition-colors ${
                isActive
                  ? 'border-macaw bg-macaw-soft text-macaw-dark'
                  : 'border-swan text-wolf hover:text-eel'
              }`
            }
          >
            {section.label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}
