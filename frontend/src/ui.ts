// Utilitários de interface: template HTML com escape automático, toasts, diálogos, formatação e estados.
import { ApiErro } from './api';

export class Html { constructor(public s: string) {} toString() { return this.s; } }
export const raw = (s: string) => new Html(s);

function escapar(v: unknown): string {
  return String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
function renderizar(v: unknown): string {
  if (v instanceof Html) return v.s;
  if (Array.isArray(v)) return v.map(renderizar).join('');
  if (v === null || v === undefined || v === false) return '';
  return escapar(v);
}
/** Tudo interpolado é escapado, exceto Html (resultado de outro html``) — XSS resolvido por padrão. */
export function html(strings: TemplateStringsArray, ...vals: unknown[]): Html {
  return new Html(strings.reduce((out, s, i) => out + s + (i < vals.length ? renderizar(vals[i]) : ''), ''));
}

export function montar(root: HTMLElement, conteudo: Html) {
  root.innerHTML = conteudo.s;
}

export function q<T extends HTMLElement = HTMLElement>(root: ParentNode, sel: string): T {
  const el = root.querySelector<T>(sel);
  if (!el) throw new Error(`Elemento não encontrado: ${sel}`);
  return el;
}

// ---------- toasts ----------
export function toast(mensagem: string, tipo: 'ok' | 'erro' | 'info' = 'info') {
  const box = document.getElementById('toasts')!;
  const el = document.createElement('div');
  el.className = `toast toast-${tipo}`;
  el.textContent = mensagem;
  box.appendChild(el);
  setTimeout(() => el.remove(), tipo === 'erro' ? 7000 : 4000);
}

// ---------- diálogo de confirmação (substitui window.confirm: acessível e com tema) ----------
export function confirmar(titulo: string, texto: string, rotulo = 'Confirmar', perigo = false): Promise<boolean> {
  return new Promise((resolve) => {
    const d = document.createElement('dialog');
    d.innerHTML = html`
      <h2 id="dlg-titulo">${titulo}</h2>
      <p>${texto}</p>
      <div class="acoes">
        <button type="button" class="btn ${perigo ? 'btn-perigo' : ''}" data-ok>${rotulo}</button>
        <button type="button" class="btn btn-fantasma" data-cancelar>Cancelar</button>
      </div>`.s;
    d.setAttribute('aria-labelledby', 'dlg-titulo');
    document.body.appendChild(d);
    const fechar = (v: boolean) => { d.close(); d.remove(); resolve(v); };
    q(d, '[data-ok]').addEventListener('click', () => fechar(true));
    q(d, '[data-cancelar]').addEventListener('click', () => fechar(false));
    d.addEventListener('cancel', (e) => { e.preventDefault(); fechar(false); });
    d.showModal();
    q(d, '[data-cancelar]').focus();
  });
}

// ---------- formulários ----------
/** Mostra erros por campo (RF04) vindos do servidor; retorna se havia erros de campo. */
export function mostrarErros(form: HTMLFormElement, erro: unknown): boolean {
  form.querySelectorAll('.erro').forEach((e) => (e.textContent = ''));
  form.querySelectorAll('[aria-invalid]').forEach((e) => e.removeAttribute('aria-invalid'));
  const geral = form.querySelector<HTMLElement>('[data-erro-geral]');
  if (!(erro instanceof ApiErro)) {
    if (geral) geral.textContent = 'Algo deu errado. Tente novamente.';
    return false;
  }
  const campos = Object.entries(erro.campos);
  for (const [campo, msg] of campos) {
    const input = form.querySelector<HTMLElement>(`[name="${campo}"]`);
    const alvo = form.querySelector<HTMLElement>(`[data-erro="${campo}"]`);
    if (input) input.setAttribute('aria-invalid', 'true');
    if (alvo) alvo.textContent = msg;
  }
  if (geral) geral.textContent = campos.length ? '' : erro.message;
  const primeiro = form.querySelector<HTMLElement>('[aria-invalid="true"]');
  primeiro?.focus();
  return campos.length > 0;
}

export function dados(form: HTMLFormElement): Record<string, string> {
  const fd = new FormData(form);
  const out: Record<string, string> = {};
  fd.forEach((v, k) => (out[k] = String(v)));
  return out;
}

// ---------- formatação ----------
export function duracao(seg: number): string {
  const h = Math.floor(seg / 3600), m = Math.floor((seg % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}min`;
  if (m > 0) return `${m} min`;
  return `${seg}s`;
}
export function relogio(seg: number): string {
  const m = Math.floor(seg / 60), s = seg % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
export function dataBr(iso?: string | null): string {
  if (!iso) return '';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}
export function dataHoraBr(iso?: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}
export function hoje(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const rotuloPrioridade: Record<string, string> = { ALTA: '▲ Alta', MEDIA: '● Média', BAIXA: '▽ Baixa' };
export const rotuloStatus: Record<string, string> = { BACKLOG: 'A fazer', EM_ANDAMENTO: 'Em andamento', CONCLUIDA: 'Concluída' };

// ---------- estados ----------
export const carregando = (texto = 'Carregando…') => html`<div class="estado" role="status"><span class="spinner" aria-hidden="true"></span> ${texto}</div>`;
export const vazio = (titulo: string, texto: string, acao?: Html) => html`<div class="estado"><strong>${titulo}</strong>${texto}${acao ? html`<div class="acoes" style="justify-content:center">${acao}</div>` : ''}</div>`;
export const erroEstado = (e: unknown, tentar?: string) => html`<div class="estado estado-erro" role="alert"><strong>Não foi possível carregar</strong>${e instanceof Error ? e.message : 'Erro inesperado.'}${tentar ? html`<div class="acoes" style="justify-content:center"><button class="btn btn-secundario" data-acao="${tentar}">Tentar de novo</button></div>` : ''}</div>`;
