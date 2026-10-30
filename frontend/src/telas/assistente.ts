// Tela 09 Assistente de IA (e versão compacta no painel). UC04, RF15, RF16, RF17, RNF09.
import { api, ApiErro, type Conversa, type LimiteIa } from '../api';
import { carregando, dataHoraBr, html, montar, q, toast } from '../ui';

const SUGESTOES = ['O que devo fazer agora?', 'Ordene minhas tarefas por urgência', 'Qual tarefa posso terminar em menos de 1 hora?'];

export async function telaAssistente(root: HTMLElement) {
  montar(root, html`
    <section class="card" style="max-width:48rem;margin:auto">
      <h1>Assistente</h1>
      <p class="muted">Ele conhece só o essencial das suas tarefas (título, prioridade, prazo, horas) e ajuda a decidir por onde começar.</p>
      <div data-chat></div>
    </section>`);
  await montarChat(q(root, '[data-chat]'), false);
}

export async function montarChat(el: HTMLElement, compacto: boolean) {
  montar(el, carregando('Abrindo o assistente…'));
  let historico: Conversa[] = [], limite: LimiteIa | null = null;
  try { [historico, limite] = await Promise.all([api.iaHistorico(), api.iaLimite()]); }
  catch { montar(el, html`<p class="muted small">Assistente indisponível no momento.</p>`); return; }

  montar(el, html`
    <div class="chat">
      ${limite && !limite.configurado ? html`<div class="alerta alerta-info small" role="status">Chave da IA não configurada no servidor: as respostas são geradas automaticamente a partir das suas tarefas (modo alternativo).</div>` : ''}
      <div class="mensagens" data-mensagens aria-live="polite" aria-label="Conversa">
        ${historico.length === 0 ? html`<p class="muted small" style="text-align:center">Nenhuma conversa ainda. Experimente uma sugestão abaixo.</p>` : ''}
        ${historico.slice(compacto ? -6 : 0).map((c) => html`
          <div class="msg msg-usuario">${c.mensagem}</div>
          ${c.resposta ? html`<div class="msg msg-ia">${c.resposta}<div class="muted small" style="margin-top:0.25rem">${dataHoraBr(c.dataHora)}</div></div>` : ''}`)}
      </div>
      <div class="sugestoes">${SUGESTOES.slice(0, compacto ? 2 : 3).map((s) => html`<button class="btn btn-fantasma btn-pequeno" type="button" data-sugestao>${s}</button>`)}</div>
      <form novalidate>
        <textarea name="mensagem" rows="1" maxlength="2000" required aria-label="Sua mensagem" placeholder="Pergunte ao assistente…"></textarea>
        <button class="btn" type="submit" aria-label="Enviar">Enviar</button>
      </form>
      <p class="muted small" data-limite></p>
    </div>`);

  const msgs = q(el, '[data-mensagens]');
  const form = q<HTMLFormElement>(el, 'form');
  const campo = q<HTMLTextAreaElement>(form, 'textarea');
  const btn = q<HTMLButtonElement>(form, 'button');
  const limiteEl = q(el, '[data-limite]');
  const mostrarLimite = (l: LimiteIa | null) => {
    if (!l) return;
    const pct = l.maximo ? Math.min(100, Math.round((l.usados / l.maximo) * 100)) : 0;
    limiteEl.textContent = `Uso do assistente hoje: ${pct}% (${l.usados} de ${l.maximo} tokens)${pct >= 100 ? ` · renova em ${dataHoraBr(l.renovaEm)}` : ''}`;
  };
  mostrarLimite(limite);
  const rolar = () => (msgs.scrollTop = msgs.scrollHeight);
  rolar();

  const enviar = async (texto: string) => {
    texto = texto.trim();
    if (!texto) return;
    msgs.querySelector('p.muted')?.remove();
    msgs.insertAdjacentHTML('beforeend', html`<div class="msg msg-usuario">${texto}</div>`.s);
    const espera = document.createElement('div');
    espera.className = 'msg msg-ia'; espera.innerHTML = '<span class="spinner" aria-hidden="true"></span> Pensando…';
    msgs.appendChild(espera); rolar();
    campo.value = ''; btn.disabled = true; campo.disabled = true;
    try {
      const r = await api.iaMensagem(texto);
      espera.outerHTML = html`<div class="msg msg-ia ${r.fallback ? 'msg-fallback' : ''}">${r.resposta}${r.fallback && r.limite.configurado ? html`<div class="small" style="margin-top:0.25rem;color:var(--color-warning)">Resposta automática: a IA não respondeu.</div>` : ''}</div>`.s;
      mostrarLimite(r.limite);
    } catch (e) {
      // RNF09: limite atingido não bloqueia o resto do app; só o assistente avisa quando renova
      const msg = e instanceof ApiErro ? e.message : 'Não foi possível falar com o assistente.';
      espera.outerHTML = html`<div class="msg msg-ia msg-fallback" role="alert">${msg}</div>`.s;
      if (e instanceof ApiErro && e.status === 429) mostrarLimite((e.corpo as { limite?: LimiteIa } | null)?.limite ?? null);
      else toast(msg, 'erro');
    } finally { btn.disabled = false; campo.disabled = false; campo.focus(); rolar(); }
  };

  form.addEventListener('submit', (e) => { e.preventDefault(); enviar(campo.value); });
  campo.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(campo.value); } });
  el.querySelectorAll('[data-sugestao]').forEach((b) => b.addEventListener('click', () => enviar(b.textContent || '')));
}
