// Roteador por hash. Regras de navegação (seção 8): toda tela autenticada a ≤2 passos do painel; nenhuma sem retorno.
import { api, type Usuario } from './api';
import { aplicarPrefs, prefsLocais } from './prefs';
import { html, montar, q, raw, toast } from './ui';

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
    delete document.documentElement.dataset.imersivo;   // só a sessão de foco ativa liga o modo imersivo
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

// UC12 atalho: alterna claro/escuro (alto contraste continua pela tela de acessibilidade)
const botaoTema = () => {
  const escuro = document.documentElement.dataset.theme === 'ESCURO';
  return html`<button type="button" class="btn-tema" data-tema aria-label="${escuro ? 'Usar tema claro' : 'Usar tema escuro'}" aria-pressed="${escuro}">${escuro ? '\u2600' : '\u263E'}</button>`;
};
function ligarBotaoTema(shell: HTMLElement) {
  q(shell, '[data-tema]').addEventListener('click', () => {
    const p = { ...prefsLocais(), tema: document.documentElement.dataset.theme === 'ESCURO' ? 'CLARO' as const : 'ESCURO' as const };
    aplicarPrefs(p);
    if (estado.usuario) api.salvarPrefs(p).catch(() => undefined);
    renderizar();
  });
}

const ICONES: Record<string, string> = {
  painel: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  foco: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/>',
  modos: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  assistente: '<path d="M4 5h16v11H9l-5 4z"/>',
  metricas: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  admin: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  equipe: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5M15 20c0-2.5 2-4 4-4s3 1.5 3 4"/>',
};
const icone = (nome: string) => raw(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONES[nome]}</svg>`);

// Casca: barra lateral fixa (≥768px) ou barra inferior (celular). RA02: tudo é link/botão nativo; RA03: nav rotulada e aria-current.
function casca(caminho: string) {
  const shell = document.getElementById('shell')!;
  if (!estado.usuario) { montar(shell, html`<header class="topbar-min">${botaoTema()}</header>`); ligarBotaoTema(shell); return; }
  const link = (href: string, ic: string, rotulo: string, ativo: boolean) =>
    html`<a href="${href}" ${ativo ? raw('aria-current="page"') : ''}>${icone(ic)}<span class="rotulo">${rotulo}</span></a>`;
  const base = caminho.split('/')[0];
  const papel = estado.usuario.papel;
  montar(shell, html`
    <aside class="sidebar">
      <a class="logo" href="#/" aria-label="Blitz, ir para o painel">B<span class="rotulo">litz</span><span class="ponto">.</span></a>
      <nav aria-label="Principal">
        ${link('#/', 'painel', 'Painel', base === '')}
        ${link('#/foco', 'foco', 'Foco', base === 'foco')}
        ${link('#/modos', 'modos', 'Modos', base === 'modos')}
        ${link('#/assistente', 'assistente', 'Assistente', base === 'assistente')}
        ${link('#/metricas', 'metricas', 'Métricas', base === 'metricas')}
        ${papel === 'ADMINISTRADOR' ? link('#/admin', 'admin', 'Administração', base === 'admin') : ''}
        ${papel === 'GESTOR' ? link('#/admin', 'equipe', 'Minha equipe', base === 'admin') : ''}
      </nav>
      <div class="rodape">
        ${botaoTema()}
        <details class="menu">
          <summary aria-label="Menu da conta de ${estado.usuario.nome}"><span class="avatar" aria-hidden="true">${estado.usuario.nome.trim().charAt(0).toUpperCase()}</span><span class="rotulo">${estado.usuario.nome.split(' ')[0]}</span></summary>
          <div class="menu-lista">
            <a href="#/perfil">Perfil e preferências</a>
            <a href="#/acessibilidade">Acessibilidade</a>
            <a href="#/privacidade">Privacidade e dados</a>
            <button type="button" data-sair>Sair</button>
          </div>
        </details>
      </div>
    </aside>`);
  ligarBotaoTema(shell);
  const menu = q<HTMLDetailsElement>(shell, '.menu');
  document.addEventListener('click', (e) => { if (!menu.contains(e.target as Node)) menu.open = false; }, { once: true });
  q(shell, '[data-sair]').addEventListener('click', async () => {
    await api.logout().catch(() => undefined);
    estado.usuario = null;
    toast('Você saiu da conta.', 'ok');
    navegar('#/login');
  });
}
