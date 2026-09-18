// Tela 08 Sessão de foco. UC03, RF10 (iniciar/pausar/encerrar), RF11 (duração registrada), RF13 (ciclos), RN03, RN05.
// O servidor guarda início/fim; o cliente controla ciclos e pausas e informa os segundos efetivamente ativos ao encerrar.
import { api, type Modo, type Sessao, type Tarefa } from '../api';
import { navegar, type Params } from '../router';
import { carregando, confirmar, erroEstado, html, montar, q, relogio, toast } from '../ui';

interface Timer { sessaoId: number; fase: 'foco' | 'pausa'; restante: number; ativos: number; rodando: boolean; ultimoTick: number; ciclos: number }
const CHAVE = 'blitz.timer';
let timer: Timer | null = carregarTimer();
let intervalo: number | undefined;
let raiz: HTMLElement | null = null;   // DOM atual da tela (o relógio continua contando fora dela)
let modoAtual: Modo | null = null;

function carregarTimer(): Timer | null { try { return JSON.parse(localStorage.getItem(CHAVE) || 'null'); } catch { return null; } }
function salvarTimer() { try { timer ? localStorage.setItem(CHAVE, JSON.stringify(timer)) : localStorage.removeItem(CHAVE); } catch { /* sem armazenamento */ } }

function bip() {
  try {
    const ctx = new AudioContext(); const o = ctx.createOscillator(); const g = ctx.createGain();
    o.frequency.value = 880; g.gain.value = 0.08; o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.25);
  } catch { /* sem áudio */ }
}

function tick() {
  if (!timer || !timer.rodando || !modoAtual) return;
  const agora = Date.now();
  const passou = Math.floor((agora - timer.ultimoTick) / 1000);
  if (passou < 1) return;
  timer.ultimoTick += passou * 1000;
  timer.restante -= passou;
  if (timer.fase === 'foco') timer.ativos += passou;
  if (timer.restante <= 0) {
    bip();
    if (timer.fase === 'foco') {
      timer.ciclos += 1;
      if (modoAtual.cicloPausaMin > 0) { timer.fase = 'pausa'; timer.restante = modoAtual.cicloPausaMin * 60; toast('Ciclo de foco concluído. Hora da pausa.', 'ok'); }
      else { timer.restante = modoAtual.cicloFocoMin * 60; toast('Ciclo concluído. Novo ciclo de foco.', 'ok'); }
    } else { timer.fase = 'foco'; timer.restante = modoAtual.cicloFocoMin * 60; toast('Pausa encerrada. De volta ao foco.', 'ok'); }
  }
  salvarTimer();
  document.title = `${relogio(Math.max(0, timer.restante))} ${timer.fase === 'foco' ? 'Foco' : 'Pausa'} · Blitz`;
  if (raiz?.querySelector('[data-tempo]')) atualizarRelogio();   // só se a tela de foco ainda estiver montada
}

function garantirIntervalo() { if (intervalo === undefined) intervalo = window.setInterval(tick, 500); }

function atualizarRelogio() {
  if (!raiz || !timer || !modoAtual) return;
  const total = (timer.fase === 'foco' ? modoAtual.cicloFocoMin : modoAtual.cicloPausaMin) * 60;
  q(raiz, '[data-tempo]').textContent = relogio(Math.max(0, timer.restante));
  q(raiz, '[data-fase]').textContent = timer.fase === 'foco' ? 'Foco' : 'Pausa';
  q(raiz, '[data-ciclos]').textContent = `${timer.ciclos} ${timer.ciclos === 1 ? 'ciclo concluído' : 'ciclos concluídos'} · ${Math.floor(timer.ativos / 60)} min ativos`;
  q(raiz, '[data-barra]').style.width = `${total ? Math.min(100, 100 - (timer.restante / total) * 100) : 100}%`;
  q(raiz, '[data-pausar]').textContent = timer.rodando ? 'Pausar' : 'Continuar';
  q(raiz, '[data-pausar]').setAttribute('aria-pressed', String(!timer.rodando));
}

export async function telaFoco(root: HTMLElement, params: Params) {
  raiz = root;
  montar(root, carregando());
  let modos: Modo[], tarefas: Tarefa[], ativa: Sessao | undefined;
  try {
    [modos, tarefas, ativa] = await Promise.all([api.modos(), api.tarefas(), api.sessaoAtiva()]);
  } catch (e) {
    montar(root, erroEstado(e, 'recarregar'));
    root.querySelector('[data-acao=recarregar]')?.addEventListener('click', () => telaFoco(root, params));
    return;
  }
  const pendentes = tarefas.filter((t) => t.status !== 'CONCLUIDA');

  if (ativa) {
    modoAtual = modos.find((m) => m.id === ativa!.modoId) ?? null;
    if (!modoAtual) { montar(root, erroEstado(new Error('O modo desta sessão não foi encontrado.'))); return; }
    if (!timer || timer.sessaoId !== ativa.id) {
      // sessão iniciada em outro dispositivo/aba: recomeça o ciclo, mas o tempo real já está no servidor
      timer = { sessaoId: ativa.id, fase: 'foco', restante: modoAtual.cicloFocoMin * 60, ativos: 0, rodando: true, ultimoTick: Date.now(), ciclos: 0 };
      salvarTimer();
    }
    desenharTimer(root, ativa, modoAtual, tarefas.find((t) => t.id === ativa!.tarefaId));
    garantirIntervalo();
    return;
  }

  timer = null; salvarTimer(); document.title = 'Sessão de foco · Blitz';

  // ---------- configurar nova sessão ----------
  const modoSel = params.modo ?? String(modos[0]?.id ?? '');
  montar(root, html`
    <section class="card" style="max-width:36rem;margin:auto">
      <h1>Nova sessão de foco</h1>
      <p class="muted">Escolha o modo e, se quiser, a tarefa. O tempo registrado vira métrica mesmo que a tarefa seja apagada depois.</p>
      <form novalidate>
        <div class="campo">
          <label for="f-modo">Modo de concentração</label>
          <select id="f-modo" name="modoId" required>
            ${modos.map((m) => html`<option value="${m.id}" ${String(m.id) === modoSel ? 'selected' : ''}>${m.nome} · ${m.cicloFocoMin} min foco / ${m.cicloPausaMin} min pausa</option>`)}
          </select>
          <span class="small"><a href="#/modos">Gerenciar modos</a></span>
        </div>
        <div class="campo">
          <label for="f-tarefa">Tarefa <span class="muted small">(opcional)</span></label>
          <select id="f-tarefa" name="tarefaId">
            <option value="">Sem tarefa específica</option>
            ${pendentes.map((t) => html`<option value="${t.id}" ${String(t.id) === params.tarefa ? 'selected' : ''}>${t.titulo}</option>`)}
          </select>
        </div>
        <p class="erro" data-erro-geral role="alert"></p>
        <div class="acoes"><button class="btn" type="submit">Iniciar sessão</button><a class="btn btn-fantasma" href="#/">Voltar ao painel</a></div>
      </form>
    </section>`);
  const form = q<HTMLFormElement>(root, 'form');
  const iniciar = async () => {
    const modoId = Number(q<HTMLSelectElement>(form, '#f-modo').value);
    const tarefaId = Number(q<HTMLSelectElement>(form, '#f-tarefa').value) || undefined;
    try {
      const s = await api.iniciarSessao(modoId, tarefaId);
      const modo = modos.find((m) => m.id === modoId)!;
      timer = { sessaoId: s.id, fase: 'foco', restante: modo.cicloFocoMin * 60, ativos: 0, rodando: true, ultimoTick: Date.now(), ciclos: 0 };
      salvarTimer();
      toast('Sessão iniciada. Bom foco!', 'ok');
      telaFoco(root, {});
    } catch (e) { q(form, '[data-erro-geral]').textContent = e instanceof Error ? e.message : 'Erro ao iniciar.'; }
  };
  form.addEventListener('submit', (e) => { e.preventDefault(); iniciar(); });
  if (params.iniciar === '1' && modos.length) iniciar();
}

function desenharTimer(root: HTMLElement, sessao: Sessao, modo: Modo, tarefa?: Tarefa) {
  modoAtual = modo;
  montar(root, html`
    <section class="card" style="max-width:36rem;margin:auto" aria-labelledby="foco-titulo">
      <h1 id="foco-titulo" style="text-align:center">${modo.nome}</h1>
      <p class="muted" style="text-align:center">${tarefa ? html`Focando em <strong>${tarefa.titulo}</strong>` : 'Sessão livre, sem tarefa vinculada'}</p>
      <div class="timer" role="timer" aria-live="off">
        <div class="tempo" data-tempo>--:--</div>
        <div class="fase" data-fase aria-live="polite"></div>
        <div class="barra" aria-hidden="true"><div data-barra style="width:0%"></div></div>
        <p class="muted small" data-ciclos></p>
      </div>
      <div class="acoes" style="justify-content:center">
        <button class="btn" type="button" data-pausar aria-pressed="false">Pausar</button>
        <button class="btn btn-fantasma" type="button" data-pular>Pular fase</button>
        <button class="btn btn-secundario" type="button" data-encerrar>Encerrar sessão</button>
      </div>
      <p style="text-align:center;margin-top:var(--space-4)"><button class="btn btn-fantasma btn-pequeno" type="button" data-descartar>Descartar sessão</button></p>
      <p class="muted small" style="text-align:center">Pausar interrompe a contagem; só o tempo em foco é registrado. Você pode navegar pelo app: o relógio continua.</p>
    </section>`);
  atualizarRelogio();

  q(root, '[data-pausar]').addEventListener('click', () => {
    if (!timer) return;
    timer.rodando = !timer.rodando; timer.ultimoTick = Date.now(); salvarTimer(); atualizarRelogio();
  });
  q(root, '[data-pular]').addEventListener('click', () => {
    if (!timer) return;
    timer.restante = 0; timer.ultimoTick = Date.now() - 1000; timer.rodando = true; tick();
  });
  q(root, '[data-encerrar]').addEventListener('click', async () => {
    if (!timer) return;
    const min = Math.round(timer.ativos / 60);
    if (!(await confirmar('Encerrar sessão?', `Serão registrados ${min} ${min === 1 ? 'minuto' : 'minutos'} de foco.`, 'Encerrar'))) return;
    try {
      await api.encerrarSessao(sessao.id, timer.ativos);
      timer = null; salvarTimer(); document.title = 'Blitz';
      toast(`Sessão encerrada: ${min} min de foco registrados.`, 'ok');
      navegar('#/metricas');
    } catch (e) { toast(e instanceof Error ? e.message : 'Erro ao encerrar.', 'erro'); }
  });
  q(root, '[data-descartar]').addEventListener('click', async () => {
    if (!(await confirmar('Descartar sessão?', 'Nada será registrado nas métricas.', 'Descartar', true))) return;
    try {
      await api.descartarSessao(sessao.id);
      timer = null; salvarTimer(); document.title = 'Blitz';
      toast('Sessão descartada.');
      navegar('#/');
    } catch (e) { toast(e instanceof Error ? e.message : 'Erro ao descartar.', 'erro'); }
  });
}
