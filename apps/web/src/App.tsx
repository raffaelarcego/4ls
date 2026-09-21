import { useQuery } from '@tanstack/react-query';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Hero } from './components/Hero';
import { Layout } from './components/Layout';
import { AnalyticsPage } from './features/analytics/AnalyticsPage';
import { LoginPage } from './features/auth/LoginPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { BasePage } from './features/base/BasePage';
import { GrammarPage } from './features/grammar/GrammarPage';
import { ReferencePage } from './features/reference/ReferencePage';
import { SessionPage } from './features/study/SessionPage';
import { TutorPage } from './features/tutor/TutorPage';
import { VocabularyPage } from './features/vocabulary/VocabularyPage';
import { api } from './services/api';
import { useAuthStore } from './stores/auth.store';

export function App() {
  const token = useAuthStore((s) => s.token);
  const setUser = useAuthStore((s) => s.setUser);

  // Revalida o token guardado no localStorage antes de liberar as rotas.
  const { isLoading, isError } = useQuery({
    queryKey: ['me', token],
    enabled: Boolean(token),
    queryFn: async () => {
      const { data } = await api.get('/auth/me');
      setUser(data);
      return data;
    },
  });

  if (!token) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        {/* A coruja aqui era resto de uma fase anterior do visual -- nao
            pertencia nem ao diario sobrio nem a expedicao. Quem espera agora e
            o proprio personagem, correndo. */}
        <Hero mood="focus" size="lg" accent="text-macaw" />
        <p className="font-bold text-wolf">Abrindo sua sessão...</p>
      </div>
    );
  }

  if (isError) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Routes>
      {/* A sessao roda em tela cheia, fora do Layout: durante a licao o app
          esconde a navegacao para nao competir com o bloco atual. */}
      <Route path="/sessao" element={<SessionPage />} />
      <Route
        path="*"
        element={
          <Layout>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/vocabulario" element={<VocabularyPage />} />
              <Route path="/estruturas" element={<GrammarPage />} />
              {/*
                Consulta, tutor e progresso vivem sob a Base: sao o que se faz
                ENTRE as missoes, e juntas liberam tres vagas no rodape.
              */}
              <Route path="/base" element={<BasePage />}>
                <Route index element={<Navigate to="consulta" replace />} />
                <Route path="consulta" element={<ReferencePage />} />
                <Route path="tutor" element={<TutorPage />} />
                <Route path="progresso" element={<AnalyticsPage />} />
              </Route>
              {/* Os enderecos antigos continuam valendo: um atalho ja salvo na
                  tela inicial do celular nao pode parar de funcionar. */}
              <Route path="/consulta" element={<Navigate to="/base/consulta" replace />} />
              <Route path="/tutor" element={<Navigate to="/base/tutor" replace />} />
              <Route path="/progresso" element={<Navigate to="/base/progresso" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        }
      />
    </Routes>
  );
}
