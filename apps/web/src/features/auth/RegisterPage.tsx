import { useMutation } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, errorMessage } from '../../services/api';
import { useAuthStore } from '../../stores/auth.store';

export function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const signIn = useAuthStore((s) => s.signIn);
  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/auth/register', { name, email, password });
      return data;
    },
    onSuccess: (data) => {
      signIn(data.accessToken, data.user);
      navigate('/');
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate();
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-5 py-10">
      <div className="text-center">
        <span className="animate-float inline-block text-6xl">🦉</span>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-grass">
          4L<span className="text-macaw">.</span>
        </h1>
        <p className="text-sm font-bold text-wolf">
          Sua conta já começa com 🇬🇧 🇪🇸 🇩🇪 configurados.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card w-full max-w-sm space-y-4">
        <div>
          <label className="label">Nome</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>

        <div>
          <label className="label">E-mail</label>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="label">Senha</label>
          <input
            className="input"
            type="password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <p className="mt-1 text-xs font-bold text-hare">Mínimo de 8 caracteres.</p>
        </div>

        {mutation.isError && (
          <p className="rounded-xl bg-cardinal-soft px-3 py-2 text-sm font-bold text-cardinal-dark">
            {errorMessage(mutation.error)}
          </p>
        )}

        <button type="submit" className="btn-primary w-full py-4" disabled={mutation.isPending}>
          {mutation.isPending ? 'Criando...' : 'Criar conta'}
        </button>

        <p className="text-center text-sm font-bold text-wolf">
          Já tem conta?{' '}
          <Link to="/login" className="text-macaw hover:underline">
            Entrar
          </Link>
        </p>
      </form>
    </div>
  );
}
