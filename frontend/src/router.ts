// Roteador por hash. Regras de navegação (seção 8): toda tela autenticada a ≤2 passos do painel; nenhuma sem retorno.
import { api, type Usuario } from './api';
import { html, montar, q, toast } from './ui';

export type Params = Record<string, string>;
export type Tela = (root: HTMLElement, params: Params) => void | Promise<void>;
interface Rota { padrao: RegExp; chaves: string[]; tela: Tela; publica: boolean; titulo: string }

export const estado: { usuario: Usuario | null } = { usuario: null };
const rotas: Rota[] = [];

export function rota(caminho: string, tela: Tela, opcoes: { publica?: boolean; titulo: string }) {
  const chaves: string[] = [];
  const re = caminho.replace(/:(\w+)/g, (_, k) => { chaves.push(k); return '([^/?]+)'; });
  rotas.push({ padrao: new RegExp(`^${re}$`), chaves, tela, publica: !!opcoes.publica, titulo: opcoes.titulo });
}

export function navegar(hash: string) {
  if (location.hash === hash) renderizar(); else location.hash = hash;
}

export function parametrosConsulta(): Params {
  const i = location.hash.indexOf('?');
  if (i < 0) return {};
  const out: Params = {};
  new URLSearchParams(location.hash.slice(i + 1)).forEach((v, k) => (out[k] = v));
  return out;
}

export async function renderizar() {
  const bruto = location.hash.replace(/^#\/?/, '');
  const caminho = bruto.split('?')[0];
  const app = document.getElementById('app')!;

  for (const r of rotas) {
    const m = caminho.match(r.padrao);
    if (!m) continue;
    if (!r.publica && !estado.usuario) { navegar('#/login'); return; }
    if (r.publica && estado.usuario && (caminho === 'login' || caminho === 'cadastro')) { navegar('#/'); return; }
    const params: Params = { ...parametrosConsulta() };
    r.chaves.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
    document.title = r.titulo === 'Blitz' ? 'Blitz' : `${r.titulo} · Blitz`;
    casca(caminho);
    try {
      await r.tela(app, params);
    } catch (e) {
      montar(app, html`<div class="estado estado-erro" role="alert"><strong>Algo deu errado</strong>${e instanceof Error ? e.message : ''}</div>`);
    }
    return;
  }
  montar(app, html`<div class="estado"><strong>Página não encontrada</strong><a href="#/">Voltar ao painel</a></div>`);
}

function casca(caminho: string) {
  const shell = document.getElementById('shell')!;
  if (!estado.usuario) { shell.innerHTML = ''; return; }
  const link = (href: string, rotulo: string, ativo: boolean) =>
    html`<a href="${href}" ${ativo ? 'aria-current="page"' : ''}>${rotulo}</a>`;
  const base = caminho.split('/')[0];
  montar(shell, html`
    <header class="topbar">
      <a class="logo" href="#/">Blitz<span>.</span></a>
      <nav class="nav" aria-label="Principal">
        ${link('#/', 'Painel', base === '')}
        ${link('#/foco', 'Foco', base === 'foco')}
        ${link('#/modos', 'Modos', base === 'modos')}
        ${link('#/assistente', 'Assistente', base === 'assistente')}
        ${link('#/metricas', 'Métricas', base === 'metricas')}
        ${estado.usuario.papel === 'ADMINISTRADOR' ? link('#/admin', 'Administração', base === 'admin') : ''}
        ${estado.usuario.papel === 'GESTOR' ? link('#/admin', 'Minha equipe', base === 'admin') : ''}
      </nav>
      <span class="spacer"></span>
      <details class="menu">
        <summary aria-label="Menu da conta de ${estado.usuario.nome}">${estado.usuario.nome.split(' ')[0]} ▾</summary>
        <div class="menu-lista">
          <a href="#/perfil">Perfil e preferências</a>
          <a href="#/acessibilidade">Acessibilidade</a>
          <a href="#/privacidade">Privacidade e dados</a>
          <button type="button" data-sair>Sair</button>
        </div>
      </details>
    </header>`);
  const menu = q<HTMLDetailsElement>(shell, '.menu');
  document.addEventListener('click', (e) => { if (!menu.contains(e.target as Node)) menu.open = false; }, { once: true });
  q(shell, '[data-sair]').addEventListener('click', async () => {
    await api.logout().catch(() => undefined);
    estado.usuario = null;
    toast('Você saiu da conta.', 'ok');
    navegar('#/login');
  });
}
