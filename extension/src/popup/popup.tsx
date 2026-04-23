/**
 * Popup da extensão — aparece ao clicar no ícone da barra.
 *
 * MVP:
 *   - Se não logado → tela de login
 *   - Se logado → saudação e botão "abrir TriboCRM" + "sair"
 *
 * No futuro: botões de ação rápida (criar lead, registrar interação).
 */

import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { sendMessage } from '@shared/utils/messaging';

function Popup() {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [authState, setAuthState] = useState<{
    isAuthenticated: boolean;
    email?: string;
  } | null>(null);

  // Checa estado de auth no mount
  useEffect(() => {
    (async () => {
      try {
        const state = await sendMessage({ type: 'AUTH_GET_STATE' });
        setAuthState(state);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleLogin(e: Event) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await sendMessage({
        type: 'AUTH_LOGIN',
        payload: { email, password }
      });
      setAuthState({ isAuthenticated: true, email: result.email });
      setEmail('');
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao entrar');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    await sendMessage({ type: 'AUTH_LOGOUT' });
    setAuthState({ isAuthenticated: false });
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--tribo-text-secondary)' }}>
        Carregando...
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <span class="tribo-logo">
          <span class="tribo-logo-tribo">Tribo</span>
          <span class="tribo-logo-crm">CRM</span>
        </span>
      </div>

      {authState?.isAuthenticated ? (
        <div>
          <p style={{ color: 'var(--tribo-text-secondary)', marginTop: 0 }}>
            Conectado como
          </p>
          <p style={{ fontWeight: 500, marginTop: 4 }}>{authState.email}</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 20 }}>
            <a
              class="tribo-btn tribo-btn-primary"
              href="https://app.tribocrm.com.br/vendas"
              target="_blank"
              rel="noopener noreferrer"
            >
              Abrir TriboCRM
            </a>
            <button class="tribo-btn tribo-btn-ghost" onClick={handleLogout}>
              Sair
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 12 }}>
            <label class="tribo-label" for="email">E-mail</label>
            <input
              class="tribo-input"
              type="email"
              id="email"
              value={email}
              onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
              required
              placeholder="voce@empresa.com"
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label class="tribo-label" for="password">Senha</label>
            <input
              class="tribo-input"
              type="password"
              id="password"
              value={password}
              onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
              required
              placeholder="••••••••"
            />
          </div>

          {error && <div class="tribo-error">{error}</div>}

          <button
            type="submit"
            class="tribo-btn tribo-btn-primary"
            style={{ width: '100%', marginTop: 12 }}
            disabled={submitting}
          >
            {submitting ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      )}
    </div>
  );
}

const root = document.getElementById('popup-root');
if (root) render(<Popup />, root);
