// Tela 09 Assistente de IA: a mesma conversa do Bolt (bolt.ts), aberta dentro da página. UC04, RF15, RF16, RF17, RNF09.
import { montarBoltNaPagina } from '../bolt';
import { html, montar, q } from '../ui';

export async function telaAssistente(root: HTMLElement) {
  montar(root, html`
    <section style="max-width:48rem;margin:auto">
      <h1>Bolt, seu agente</h1>
      <p class="muted">Ele conhece só o essencial das suas tarefas (título, prioridade, prazo, horas) e ajuda a decidir por onde começar. Nas outras telas, ele fica no canto e mostra onde fica cada coisa.</p>
      <div data-bolt-pagina></div>
    </section>`);
  await montarBoltNaPagina(q(root, '[data-bolt-pagina]'));
}
