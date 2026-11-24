// Bolt: o agente do Blitz (UC04, RF15, RF16, RF17, RNF09). Orbe flutuante em todas as telas autenticadas; clicar abre a conversa.
// Visor mostra o estado (pensando, falando, contente), explica cada tela, aponta na tela o que cita ([[Nome]] → botão que leva
// até o elemento com data-bolt="Nome"), oferece ajuda na primeira visita a cada tela e, dispensado, espia pela borda da barra lateral.
// Desenho e animação só com SVG + CSS (styles.css, seção "Bolt"); cores pelos tokens --bolt-*. RA02: tudo é <button>; RA06: sem movimento
// quando a pessoa pede menos animação.
import './bolt.css';
import { api, ApiErro, type Conversa, type LimiteIa, type RespostaIa } from './api';
import { estado, navegar } from './router';
import { dataHoraBr, html, raw, toast, type Html } from './ui';

type Estado = 'parada' | 'pensando' | 'falando' | 'feliz' | 'acenando' | 'piscando' | 'dormindo' | 'apontaEsq' | 'apontaDir';

// ---------- desenho ----------
/** O orbe: corpo azul da marca, visor grafite, dois arcos em volta e um raio no topo. */
export function avatar(estado: Estado = 'parada', tamanho = 76): Html {
  return raw(`<svg class="bolt" data-estado="${estado}" viewBox="0 0 120 132" width="${tamanho}" height="${Math.round(tamanho * 1.1)}" aria-hidden="true" focusable="false">
  <ellipse class="bolt-sombra" cx="60" cy="124" rx="24" ry="4"/>
  <g class="bolt-flutua">
    <g class="bolt-aneis"><path class="bolt-anel" d="M8 50 A54 54 0 0 1 74 12"/><path class="bolt-anel" d="M112 78 A54 54 0 0 1 46 116"/></g>
    <g class="bolt-orbe">
      <path class="bolt-raio" d="M90 4 L78 25 L86 25 L80 40 L97 18 L88 18 L95 4 Z"/>
      <circle class="bolt-esfera" cx="60" cy="64" r="44"/>
      <path class="bolt-sombreado" d="M16 64 A44 44 0 0 0 104 64 A44 30 0 0 1 16 64 Z"/>
      <rect class="bolt-visor" x="29" y="49" width="62" height="30" rx="15"/>
      <g class="bolt-rosto">
        <g class="bolt-olhos"><rect class="bolt-olho" x="45.5" y="57.5" width="5" height="13" rx="2.5"/><rect class="bolt-olho" x="69.5" y="57.5" width="5" height="13" rx="2.5"/></g>
        <path class="bolt-olhos-feliz" d="M43 67.5 Q48 59.5 53 67.5 M67 67.5 Q72 59.5 77 67.5"/>
        <g class="bolt-piscadela"><rect class="bolt-olho" x="45.5" y="57.5" width="5" height="13" rx="2.5"/><path d="M67 66.5 Q72 60.5 77 66.5"/></g>
        <g class="bolt-pensa"><circle cx="49" cy="64" r="2.7"/><circle cx="60" cy="64" r="2.7"/><circle cx="71" cy="64" r="2.7"/></g>
        <g class="bolt-fala"><rect x="46" y="58" width="4" height="12" rx="2"/><rect x="54" y="54" width="4" height="20" rx="2"/><rect x="62" y="56" width="4" height="16" rx="2"/><rect x="70" y="59" width="4" height="10" rx="2"/></g>
      </g>
    </g>
  </g>
</svg>`);
}

const ICONE = {
  fechar: '<path d="M6 6l12 12M18 6L6 18"/>',
  esconder: '<path d="M7 6l5 5 5-5M7 13l5 5 5-5"/>',
  limpar: '<path d="M4 20h16M7 16l9.5-9.5a2.1 2.1 0 0 1 3 3L10 19H7z"/>',
  enviar: '<path d="M4 12l16-8-6 16-2.5-6.5z"/>',
  alvo: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5"/>',
  copiar: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h10"/>',
};
const icone = (n: keyof typeof ICONE, px = 16) => raw(`<svg viewBox="0 0 24 24" width="${px}" height="${px}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONE[n]}</svg>`);

// ---------- telas ----------
/** Nome de cada tela (o mesmo do back, TelasBlitz) e as perguntas prontas dela. Sem explicação: só as perguntas. */
const TELAS: Record<string, { nome: string; explica: boolean; perguntas: string[] }> = {
  '': { nome: 'Painel', explica: true, perguntas: ['O que devo fazer agora?', 'Tenho 30 minutos, o que dá para fazer?', 'O que está atrasado?'] },
  foco: { nome: 'Foco', explica: true, perguntas: ['Qual modo de foco devo usar?', 'O que devo fazer agora?'] },
  modos: { nome: 'Modos', explica: true, perguntas: ['Qual modo de foco devo usar?'] },
  metricas: { nome: 'Métricas', explica: true, perguntas: ['Como foi minha semana?', 'Vai dar tempo esta semana?'] },
  perfil: { nome: 'Perfil', explica: true, perguntas: [] },
  acessibilidade: { nome: 'Acessibilidade', explica: true, perguntas: [] },
  privacidade: { nome: 'Privacidade', explica: true, perguntas: [] },
  tarefas: { nome: 'Tarefa', explica: true, perguntas: ['Como dividir esta tarefa?'] },
  admin: { nome: 'Administração', explica: false, perguntas: [] },
};
const GERAIS = ['O que devo fazer agora?', 'Como foi minha semana?', 'O que está atrasado?'];
const explicar = (tela: string) => `Me explica a tela ${tela}: para que ela serve e o que dá para fazer aqui?`;

// ---------- apontar na tela ----------
const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
const visivel = (e: HTMLElement) => e.getClientRects().length > 0;
const marcados = () => [...document.querySelectorAll<HTMLElement>('#app [data-bolt]')].filter(visivel);
const acharNaTela = (nome: string) => marcados().find((e) => norm(e.dataset.bolt ?? '') === norm(nome));
const semMovimento = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduzir';

const relogios = new WeakMap<HTMLElement, number>();
function destacar(el: HTMLElement, rolar: boolean) {
  if (rolar) el.scrollIntoView({ block: 'center', behavior: semMovimento() ? 'auto' : 'smooth' });
  clearTimeout(relogios.get(el));
  el.classList.remove('bolt-destaque');
  void el.offsetWidth;   // recomeça a animação se o item já estava destacado
  el.classList.add('bolt-destaque');
  relogios.set(el, window.setTimeout(() => el.classList.remove('bolt-destaque'), 2600));
  olharPara(el.getBoundingClientRect(), rolar);
}
/** Destaca a parte da tela com esse nome; false se ela não está na tela. O nome só é comparado, nunca vira seletor. */
function apontar(nome: string, rolar = true) { const el = acharNaTela(nome); if (el) destacar(el, rolar); return !!el; }
function apontarTarefa(id: number, rolar = true) {
  const el = [...document.querySelectorAll<HTMLElement>('#app [data-bolt-tarefa]')].find((e) => e.dataset.boltTarefa === String(id) && visivel(e));
  if (el) destacar(el, rolar);
  return !!el;
}

/** Texto da resposta com [[Nome]] trocado por um botão "mostrar na tela" (ou só negrito, se a parte não está nesta tela). */
const MARCA = /\[\[([^[\]]{1,40})\]\]/g;
function comPontos(t: string): Html {
  let out = '', i = 0;
  for (const m of t.matchAll(MARCA)) {
    const nome = m[1].trim();
    out += html`${t.slice(i, m.index)}`.s + (acharNaTela(nome)
      ? html`<button type="button" class="bolt-ponto" data-apontar="${nome}" title="Mostrar na tela">${icone('alvo', 14)}${nome}</button>`.s
      : html`<strong>${nome}</strong>`.s);
    i = m.index! + m[0].length;
  }
  return raw(out + html`${t.slice(i)}`.s);
}
const semMarcas = (t: string) => t.replace(MARCA, '$1');

// ---------- estado do agente ----------
interface Guardado { vistas: string[]; recolhido: boolean }
let usuario: { id: number; primeiroNome: string } | null = null;
let chave = '#inicio', aberto = false, ocupado = false, embutido: HTMLElement | null = null;   // '#inicio' ≠ qualquer rota: a 1ª tela conta como troca
let historico: Conversa[] | null = null, limite: LimiteIa | null = null;
let raiz: HTMLElement | null = null, humorAte = 0, ultimoMovimento = Date.now(), balaoRelogio = 0;
let tarefaPendente: number | null = null;   // "Mostrar no quadro" pedido fora do painel: aponta quando o quadro abrir

const chaveLocal = () => `blitz.bolt.${usuario?.id}`;
function guardado(): Guardado {
  try { const g = JSON.parse(localStorage.getItem(chaveLocal()) ?? 'null'); if (g && Array.isArray(g.vistas)) return g; } catch { /* sem armazenamento */ }
  return { vistas: [], recolhido: false };
}
function guardar(g: Partial<Guardado>) { try { localStorage.setItem(chaveLocal(), JSON.stringify({ ...guardado(), ...g })); } catch { /* vale só agora */ } }

const tela = () => TELAS[chave] ?? null;

function mudarEstado(e: Estado) { document.querySelectorAll<SVGElement>('svg.bolt').forEach((s) => (s.dataset.estado = e)); }
/** Um humor por um tempo (acenar, comemorar, apontar) e volta ao normal. */
function humor(e: Estado, ms: number) {
  humorAte = Date.now() + ms;
  mudarEstado(e);
  window.setTimeout(() => { if (Date.now() >= humorAte && !ocupado) mudarEstado('parada'); }, ms);
}
function olharPara(alvo: DOMRect, rolou: boolean) {
  const b = raiz?.querySelector<HTMLElement>('.bolt-botao');
  if (!b || !raiz) return;
  const q = b.getBoundingClientRect();
  const dx = alvo.left + alvo.width / 2 - (q.left + q.width / 2), dy = alvo.top + alvo.height / 2 - (q.top + q.height / 2), d = Math.hypot(dx, dy) || 1;
  raiz.style.setProperty('--olho-x', `${((dx / d) * 3.2).toFixed(2)}px`);
  raiz.style.setProperty('--olho-y', `${((dy / d) * 2.6).toFixed(2)}px`);
  humor(dx < 0 ? 'apontaEsq' : 'apontaDir', 2400);
  if (rolou && aberto) {   // a conversa fica quase transparente enquanto ele mostra, para não ficar na frente
    raiz.querySelector('.bolt-painel')?.classList.add('apagado');
    window.setTimeout(() => raiz?.querySelector('.bolt-painel')?.classList.remove('apagado'), 2400);
  }
}

// ---------- montagem ----------
/** Chamado pelo roteador depois de cada tela: mostra, esconde ou atualiza o Bolt. */
export function boltNaTela(base: string, logado: { id: number; nome: string } | null) {
  if (!logado) { raiz?.remove(); raiz = null; usuario = null; historico = null; aberto = false; chave = '#inicio'; delete document.documentElement.dataset.bolt; return; }
  if (usuario?.id !== logado.id) { historico = null; aberto = false; }
  usuario = { id: logado.id, primeiroNome: logado.nome.trim().split(/\s+/)[0] };
  const mudou = base !== chave;
  chave = base;
  if (base === 'assistente') { raiz?.remove(); raiz = null; delete document.documentElement.dataset.bolt; return; }   // a própria tela já é a conversa
  document.documentElement.dataset.bolt = '1';
  if (!raiz) { raiz = Object.assign(document.createElement('div'), { className: 'bolt-raiz' }); document.body.appendChild(raiz); ligarOlhar(); }
  desenhar(mudou);
  if (tarefaPendente !== null) { const id = tarefaPendente; tarefaPendente = null; window.setTimeout(() => apontarTarefa(id), 150); }
  if (mudou) agendarBalao();
}

/** A tela Assistente (09) mostra a mesma conversa, dentro da página. */
export async function montarBoltNaPagina(el: HTMLElement) {
  embutido = el;
  chave = 'assistente';   // sugestões gerais; o roteador só chama boltNaTela depois que esta tela termina de montar
  if (estado.usuario && usuario?.id !== estado.usuario.id) { usuario = { id: estado.usuario.id, primeiroNome: estado.usuario.nome.trim().split(/\s+/)[0] }; historico = null; }
  await carregarConversa();
  desenharPainel(el, true);
}

function desenhar(passo: boolean) {
  if (!raiz) return;
  const g = guardado();
  if (g.recolhido) {
    raiz.innerHTML = html`<button type="button" class="bolt-espia" aria-label="Chamar o Bolt de volta" title="Chamar o Bolt">${raw(`<span>${avatar('parada', 56).s}</span>`)}</button>`.s;
    raiz.querySelector('.bolt-espia')!.addEventListener('click', () => {
      guardar({ recolhido: false }); desenhar(false); humor('feliz', 1300);
      raiz?.querySelector<HTMLElement>('.bolt-botao')?.focus();
    });
    return;
  }
  raiz.querySelector('.bolt-espia')?.remove();
  // Montado uma vez; nas trocas de tela só muda o que precisa (senão o balão some e a animação de entrada se repete).
  if (!raiz.querySelector('.bolt-flutuante')) {
    raiz.innerHTML = html`
      <div class="bolt-flutuante">
        <div data-balao></div>
        <div data-painel></div>
        <button type="button" class="bolt-botao" aria-controls="bolt-painel">${avatar(ocupado ? 'pensando' : 'parada')}</button>
        <button type="button" class="bolt-dispensar" aria-label="Esconder o Bolt na lateral" title="Esconder o Bolt (ele fica espiando na lateral)">${icone('fechar', 14)}</button>
      </div>`.s;
    raiz.querySelector('.bolt-botao')!.addEventListener('click', () => (aberto ? fechar() : abrir()));
    raiz.querySelector('.bolt-dispensar')!.addEventListener('click', dispensar);
  }
  const botao = raiz.querySelector<HTMLElement>('.bolt-botao')!;
  botao.setAttribute('aria-expanded', String(aberto));
  botao.setAttribute('aria-label', aberto ? 'Fechar a conversa com o Bolt' : 'Falar com o Bolt');
  botao.title = aberto ? 'Fechar a conversa' : 'Falar com o Bolt';
  if (passo) { botao.classList.remove('bolt-passo'); void botao.offsetWidth; botao.classList.add('bolt-passo'); }
  const painel = raiz.querySelector<HTMLElement>('[data-painel]')!;
  if (aberto) desenharPainel(painel, false); else painel.innerHTML = '';
}

async function abrir(pergunta?: string) {
  if (!raiz) return;
  aberto = true; limparBalao();
  desenhar(false);
  await carregarConversa();
  if (!aberto || !raiz) return;
  const alvo = raiz.querySelector<HTMLElement>('[data-painel]')!;
  desenharPainel(alvo, false);
  if (pergunta) enviar(alvo, pergunta);
}
function fechar() {
  aberto = false;
  desenhar(false);
  raiz?.querySelector<HTMLElement>('.bolt-botao')?.focus();
  humor('piscando', 900);
}
function dispensar() {
  aberto = false; limparBalao();
  humor('acenando', 700);
  window.setTimeout(() => { guardar({ recolhido: true }); desenhar(false); raiz?.querySelector<HTMLElement>('.bolt-espia')?.focus(); }, semMovimento() ? 0 : 650);
}

async function carregarConversa() {
  if (historico) return;
  try { [historico, limite] = await Promise.all([api.iaHistorico(), api.iaLimite()]); }
  catch { historico = []; }
}

// ---------- balão (primeira vez) ----------
function limparBalao() { clearTimeout(balaoRelogio); const b = raiz?.querySelector('[data-balao]'); if (b) b.innerHTML = ''; }
function agendarBalao() {
  limparBalao();   // o da tela anterior sai
  balaoRelogio = window.setTimeout(() => {
    if (!raiz || aberto || guardado().recolhido) return;
    const g = guardado(), t = tela();
    const alvo = raiz.querySelector<HTMLElement>('[data-balao]');
    if (!alvo) return;
    if (!g.vistas.includes('@ola')) {
      guardar({ vistas: [...g.vistas, '@ola'] });
      alvo.innerHTML = html`<div class="bolt-balao" role="status">
        <button type="button" class="bolt-balao-x" data-x aria-label="Fechar o aviso do Bolt">${icone('fechar', 14)}</button>
        <p><strong>Oi, ${usuario?.primeiroNome}! Eu sou o Bolt.</strong> Vou te acompanhar pelo Blitz: explico as telas, mostro onde fica cada coisa e ajudo a decidir o que fazer agora. É só clicar em mim.</p>
        <div class="bolt-balao-acoes"><button type="button" class="bolt-chip bolt-chip-forte" data-x>Combinado!</button></div>
      </div>`.s;
      humor('acenando', 2600);
    } else if (t?.explica && !g.vistas.includes(chave)) {
      guardar({ vistas: [...g.vistas, chave] });
      alvo.innerHTML = html`<div class="bolt-balao" role="status">
        <button type="button" class="bolt-balao-x" data-x aria-label="Fechar o aviso do Bolt">${icone('fechar', 14)}</button>
        <p>Primeira vez em <strong>${t.nome}</strong>? Posso te mostrar como esta tela funciona.</p>
        <div class="bolt-balao-acoes"><button type="button" class="bolt-chip bolt-chip-forte" data-mostra>Me mostra</button><button type="button" class="bolt-chip" data-x>Agora não</button></div>
      </div>`.s;
      alvo.querySelector('[data-mostra]')!.addEventListener('click', () => abrir(explicar(t.nome)));
    } else return;
    alvo.querySelectorAll('[data-x]').forEach((b) => b.addEventListener('click', () => { limparBalao(); humor('piscando', 900); }));
    balaoRelogio = window.setTimeout(limparBalao, 14000);   // ignorado, some sozinho
  }, 1800);
}

// ---------- painel de conversa ----------
function sugestoes(): { rotulo: string; pergunta: string; forte?: boolean }[] {
  const t = tela();
  const qs = t && t.perguntas.length ? t.perguntas : GERAIS;
  return [
    ...(t?.explica ? [{ rotulo: `Me explica a tela ${t.nome}`, pergunta: explicar(t.nome), forte: true }] : []),
    ...qs.slice(0, 3).map((p) => ({ rotulo: p, pergunta: p })),
  ];
}

function bolha(c: Conversa | { mensagem: string; resposta?: string; dataHora?: string }): Html {
  return html`<div class="msg msg-usuario">${c.mensagem}</div>${c.resposta ? html`<div class="bolt-resposta"><div class="msg msg-ia">${comPontos(c.resposta)}</div>
    <div class="bolt-msg-rodape">${c.dataHora ? html`<span>${dataHoraBr(c.dataHora)}</span>` : ''}<button type="button" class="bolt-icone-btn" data-copiar aria-label="Copiar a resposta" title="Copiar a resposta">${icone('copiar', 14)}</button></div></div>` : ''}`;
}

function rodapeLimite(): string {
  if (!limite) return 'Só falo do Blitz.';
  if (!limite.configurado) return 'Modo automático: respondo com base nas suas tarefas, prazos e tempo de foco.';
  const pct = limite.maximo ? Math.min(100, Math.round((limite.usados / limite.maximo) * 100)) : 0;
  return `Uso da IA hoje: ${pct}%${pct >= 100 ? `, renova em ${dataHoraBr(limite.renovaEm)}` : ''}.`;
}

function desenharPainel(el: HTMLElement, naPagina: boolean) {
  const t = tela();
  const vazio = !historico || historico.length === 0;
  el.innerHTML = html`
    <section class="bolt-painel ${naPagina ? 'bolt-painel-pagina' : ''}" id="bolt-painel" ${naPagina ? '' : raw('role="dialog"')} aria-label="Conversa com o Bolt">
      <header class="bolt-topo">
        <span class="bolt-topo-avatar">${avatar(ocupado ? 'pensando' : 'parada', 40)}</span>
        <div class="bolt-topo-texto"><strong>Bolt</strong><span>${t && !naPagina ? html`Com você em <b>${t.nome}</b>` : 'Seu agente no Blitz'}</span></div>
        ${vazio ? '' : html`<button type="button" class="bolt-topo-btn" data-limpar aria-label="Limpar a conversa" title="Limpar a conversa">${icone('limpar')}</button>`}
        ${naPagina ? '' : html`<button type="button" class="bolt-topo-btn" data-esconder aria-label="Esconder o Bolt na lateral" title="Esconder o Bolt">${icone('esconder')}</button>
        <button type="button" class="bolt-topo-btn" data-fechar aria-label="Fechar a conversa" title="Fechar a conversa">${icone('fechar')}</button>`}
      </header>
      <div class="bolt-mensagens" data-mensagens aria-live="polite">
        ${vazio ? html`<div class="bolt-ola">
            <p class="bolt-ola-titulo">Oi, ${usuario?.primeiroNome ?? ''}!</p>
            <p>Eu te acompanho pelo Blitz: ajudo a decidir o que fazer agora, explico as telas e mostro onde fica cada coisa.</p>
            <div class="bolt-chips">${sugestoes().map((s) => html`<button type="button" class="bolt-chip ${s.forte ? 'bolt-chip-forte' : ''}" data-pergunta="${s.pergunta}">${s.rotulo}</button>`)}</div>
          </div>`
          : historico!.map((c) => bolha(c))}
      </div>
      <form class="bolt-entrada" novalidate>
        <textarea name="mensagem" rows="1" maxlength="2000" aria-label="Sua pergunta para o Bolt" placeholder="Pergunte ao Bolt…"></textarea>
        <button type="submit" class="btn btn-icone" aria-label="Enviar">${icone('enviar', 18)}</button>
      </form>
      <p class="bolt-nota" data-nota>${rodapeLimite()}</p>
    </section>`.s;

  const msgs = el.querySelector<HTMLElement>('[data-mensagens]')!;
  const form = el.querySelector<HTMLFormElement>('form')!;
  const campo = form.querySelector('textarea')!;
  msgs.scrollTop = msgs.scrollHeight;
  ligarMensagens(msgs);
  msgs.querySelectorAll<HTMLButtonElement>('[data-pergunta]').forEach((b) => b.addEventListener('click', () => enviar(el, b.dataset.pergunta!)));
  form.addEventListener('submit', (e) => { e.preventDefault(); enviar(el, campo.value); });
  campo.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(el, campo.value); } });
  campo.addEventListener('input', () => { campo.style.height = 'auto'; campo.style.height = `${Math.min(campo.scrollHeight + 2, 112)}px`; });
  el.querySelector('[data-fechar]')?.addEventListener('click', fechar);
  el.querySelector('[data-esconder]')?.addEventListener('click', dispensar);
  el.querySelector('[data-limpar]')?.addEventListener('click', async () => {
    try { await api.iaLimpar(); historico = []; desenharPainel(el, naPagina); toast('Conversa apagada.', 'ok'); }
    catch (e) { toast(e instanceof Error ? e.message : 'Não foi possível limpar.', 'erro'); }
  });
  el.querySelector('.bolt-painel')!.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Escape' && !naPagina) { e.stopPropagation(); fechar(); } });
  if (matchMedia('(pointer: fine)').matches) campo.focus();   // no celular não, para o teclado não pular na cara
}

function ligarMensagens(raizMsgs: HTMLElement) {
  raizMsgs.querySelectorAll<HTMLButtonElement>('[data-apontar]').forEach((b) => b.addEventListener('click', () => {
    if (!apontar(b.dataset.apontar!)) toast('Essa parte não está nesta tela.', 'info');
  }));
  raizMsgs.querySelectorAll<HTMLButtonElement>('[data-copiar]').forEach((b) => b.addEventListener('click', async () => {
    const txt = b.closest('.bolt-resposta')?.querySelector('.msg-ia')?.textContent ?? '';
    try { await navigator.clipboard.writeText(semMarcas(txt)); toast('Resposta copiada.', 'ok'); } catch { /* área de transferência indisponível */ }
  }));
}

async function enviar(el: HTMLElement, texto: string) {
  texto = texto.trim();
  if (!texto || ocupado) return;
  const msgs = el.querySelector<HTMLElement>('[data-mensagens]')!;
  const form = el.querySelector<HTMLFormElement>('form')!;
  const campo = form.querySelector('textarea')!, btn = form.querySelector('button')!;
  msgs.querySelector('.bolt-ola')?.remove();
  msgs.insertAdjacentHTML('beforeend', html`<div class="msg msg-usuario">${texto}</div>`.s);
  const espera = Object.assign(document.createElement('div'), { className: 'msg msg-ia bolt-digitando' });
  espera.innerHTML = '<span></span><span></span><span></span><span class="sr-only">O Bolt está pensando</span>';
  msgs.appendChild(espera); msgs.scrollTop = msgs.scrollHeight;
  campo.value = ''; campo.style.height = ''; ocupado = true; btn.disabled = true;
  mudarEstado('pensando');
  const t = tela();
  try {
    const r: RespostaIa = await api.iaMensagem(texto, embutido && el === embutido ? 'Assistente' : t?.nome, marcados().map((e) => e.dataset.bolt!).filter((v, i, a) => a.indexOf(v) === i).slice(0, 20));
    limite = r.limite;
    historico = [...(historico ?? []), { id: 0, mensagem: texto, resposta: r.resposta, dataHora: new Date().toISOString() }];
    const bloco = document.createElement('div');
    bloco.innerHTML = bolha({ mensagem: '', resposta: r.resposta, dataHora: new Date().toISOString() }).s;
    bloco.querySelector('.msg-usuario')?.remove();
    const resposta = bloco.firstElementChild as HTMLElement;
    if (r.fallback && r.limite.configurado) resposta.querySelector('.msg-ia')?.insertAdjacentHTML('beforeend', html`<div class="bolt-aviso">Resposta automática: a IA não respondeu agora.</div>`.s);
    if (r.tarefasSugeridas?.length) resposta.insertAdjacentHTML('beforeend', html`<div class="bolt-acoes">
      <button type="button" class="bolt-chip bolt-chip-forte" data-focar="${r.tarefasSugeridas[0]}">Focar na primeira</button>
      <button type="button" class="bolt-chip" data-mostrar="${r.tarefasSugeridas[0]}">${icone('alvo', 14)}Mostrar no quadro</button>
      ${r.tarefasSugeridas.length > 1 ? html`<button type="button" class="bolt-chip" data-ordenar="${r.tarefasSugeridas.join(',')}">Aplicar ordem no quadro</button>` : ''}
    </div>`.s);
    espera.replaceWith(resposta);
    ligarMensagens(resposta);
    resposta.querySelector<HTMLButtonElement>('[data-focar]')?.addEventListener('click', (e) => navegar(`#/foco?tarefa=${(e.currentTarget as HTMLElement).dataset.focar}`));
    resposta.querySelector<HTMLButtonElement>('[data-mostrar]')?.addEventListener('click', (e) => {
      const id = Number((e.currentTarget as HTMLElement).dataset.mostrar);
      if (!apontarTarefa(id)) { tarefaPendente = id; navegar('#/'); }
    });
    resposta.querySelector<HTMLButtonElement>('[data-ordenar]')?.addEventListener('click', async (e) => {
      const b = e.currentTarget as HTMLButtonElement;
      b.disabled = true;
      try {
        await api.ordenarTarefas(b.dataset.ordenar!.split(',').map(Number));
        b.textContent = 'Ordem aplicada';
        toast('Ordem aplicada no quadro.', 'ok');
        if (chave === '') navegar(location.hash || '#/');   // redesenha o quadro; o Bolt fica fora de #app e continua aberto
      } catch (err) { toast(err instanceof Error ? err.message : 'Erro ao ordenar.', 'erro'); b.disabled = false; }
    });
    el.querySelector('[data-nota]')!.textContent = rodapeLimite();
    // terminou: fala um instante, comemora e realça (sem rolar) o que citou
    humor('falando', 900);
    window.setTimeout(() => humor('feliz', 1300), 900);
    [...r.resposta.matchAll(MARCA)].slice(0, 3).forEach((m) => apontar(m[1].trim(), false));
    if (r.tarefasSugeridas?.length) apontarTarefa(r.tarefasSugeridas[0], false);
  } catch (e) {
    // RNF09: limite atingido não trava o resto do app; só o Bolt avisa quando renova
    const msg = e instanceof ApiErro ? e.message : 'Não foi possível falar com o Bolt agora.';
    espera.outerHTML = html`<div class="msg msg-ia msg-fallback" role="alert">${msg}</div>`.s;
    if (e instanceof ApiErro && e.status === 429) { limite = (e.corpo as { limite?: LimiteIa } | null)?.limite ?? limite; el.querySelector('[data-nota]')!.textContent = rodapeLimite(); }
    mudarEstado('parada');
  } finally {
    ocupado = false; btn.disabled = false;
    msgs.scrollTop = msgs.scrollHeight;
    if (matchMedia('(pointer: fine)').matches) campo.focus();
  }
}

// ---------- olhar e cochilo ----------
function ligarOlhar() {
  let quadro = 0;
  window.addEventListener('pointermove', (e) => {
    ultimoMovimento = Date.now();
    if (!raiz || semMovimento() || quadro) return;
    quadro = requestAnimationFrame(() => {
      quadro = 0;
      const b = raiz?.querySelector<HTMLElement>('.bolt-botao');
      if (!b || !raiz || Date.now() < humorAte) return;
      const q = b.getBoundingClientRect();
      const dx = e.clientX - (q.left + q.width / 2), dy = e.clientY - (q.top + q.height / 2), d = Math.hypot(dx, dy) || 1, f = Math.min(1, d / 240);
      raiz.style.setProperty('--olho-x', `${((dx / d) * 3.2 * f).toFixed(2)}px`);
      raiz.style.setProperty('--olho-y', `${((dy / d) * 2.6 * f).toFixed(2)}px`);
    });
  }, { passive: true });
  window.addEventListener('keydown', () => (ultimoMovimento = Date.now()));
  window.setInterval(() => {   // 90 s sem mexer: cochila; qualquer movimento acorda
    const dormindo = Date.now() - ultimoMovimento > 90_000;
    const svg = raiz?.querySelector<SVGElement>('.bolt-botao svg.bolt, .bolt-espia svg.bolt');
    if (!svg || ocupado || Date.now() < humorAte) return;
    if (dormindo && svg.dataset.estado === 'parada') mudarEstado('dormindo');
    else if (!dormindo && svg.dataset.estado === 'dormindo') mudarEstado('parada');
  }, 5000);
}
