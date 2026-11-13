import './styles.css';
import { api, ApiErro, aoDemorar, aoExpirar } from './api';
import { toast } from './ui';
import { aplicarPrefs } from './prefs';
import { estado, navegar, renderizar, rota } from './router';
import { telaLogin, telaCadastro, telaRecuperar, telaRedefinir, telaTermos } from './telas/auth';
import { telaPainel } from './telas/painel';
import { telaTarefa } from './telas/tarefa';
import { telaModos } from './telas/modos';
import { telaFoco } from './telas/foco';
import { telaAssistente } from './telas/assistente';
import { telaMetricas } from './telas/metricas';
import { telaPerfil, telaAcessibilidade } from './telas/perfil';
import { telaPrivacidade, telaExportar, telaExcluirConta } from './telas/privacidade';
import { telaAdmin } from './telas/admin';

// Inventário de telas (seção 8): 01 carregamento está no index.html
rota('login', telaLogin, { publica: true, titulo: 'Entrar' });                       // 02
rota('cadastro', telaCadastro, { publica: true, titulo: 'Criar conta' });            // 03
rota('recuperar', telaRecuperar, { publica: true, titulo: 'Recuperar senha' });      // 04
rota('redefinir', telaRedefinir, { publica: true, titulo: 'Redefinir senha' });      // 04 (passo 2, via link do e-mail)
rota('termos', telaTermos, { publica: true, titulo: 'Termos e Privacidade' });
rota('', telaPainel, { titulo: 'Blitz' });                                            // 05
rota('tarefas/:id', telaTarefa, { titulo: 'Tarefa' });                               // 06
rota('modos', telaModos, { titulo: 'Modos de concentração' });                       // 07
rota('foco', telaFoco, { titulo: 'Sessão de foco' });                                // 08
rota('assistente', telaAssistente, { titulo: 'Assistente' });                        // 09
rota('metricas', telaMetricas, { titulo: 'Métricas e histórico' });                  // 10
rota('perfil', telaPerfil, { titulo: 'Perfil' });                                    // 11
rota('acessibilidade', telaAcessibilidade, { titulo: 'Acessibilidade' });            // 12
rota('privacidade', telaPrivacidade, { titulo: 'Privacidade e dados' });             // 13
rota('privacidade/exportar', telaExportar, { titulo: 'Exportar dados' });            // 14
rota('privacidade/excluir', telaExcluirConta, { titulo: 'Excluir conta' });          // 15
rota('admin', telaAdmin, { titulo: 'Administração' });                               // UC06–UC10 (sem tela prototipada)

// RNF08 (plano gratuito): avisa quando o servidor está acordando, na tela de carregamento e como toast, no máximo uma vez por minuto
let avisado = false;
aoDemorar(() => {
  if (avisado) return;
  avisado = true; setTimeout(() => (avisado = false), 60000);
  const msg = 'O servidor está acordando. No plano gratuito do protótipo isso pode levar até um minuto.';
  const inicial = document.querySelector('#app > .estado[role="status"]');
  if (inicial) inicial.insertAdjacentHTML('beforeend', `<p class="small" style="margin:var(--space-3) auto 0">${msg}</p>`);
  else toast(msg + ' Aguarde, a ação continua em andamento.', 'info');
});

// RN01: sessão perdida no servidor leva ao login com explicação, em vez de deixar a tela em estado de erro
aoExpirar(() => {
  if (!estado.usuario) return;
  estado.usuario = null;
  toast('Sua sessão expirou. Entre de novo para continuar.', 'info');
  navegar('#/login');
});

async function iniciar() {
  try {
    estado.usuario = await api.me();
    aplicarPrefs(await api.prefs());
  } catch (e) {
    estado.usuario = null;
    if (!(e instanceof ApiErro) || e.status !== 401) console.warn('Falha ao restaurar sessão', e);
  }
  window.addEventListener('hashchange', renderizar);
  renderizar();
}

iniciar();
