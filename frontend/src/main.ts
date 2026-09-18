import './styles.css';
import { api, ApiErro } from './api';
import { aplicarPrefs } from './prefs';
import { estado, renderizar, rota } from './router';
import { telaLogin, telaCadastro, telaRecuperar, telaTermos } from './telas/auth';
import { telaPainel } from './telas/painel';
import { telaTarefa } from './telas/tarefa';
import { telaModos } from './telas/modos';
import { telaFoco } from './telas/foco';
import { telaAssistente } from './telas/assistente';
import { telaMetricas } from './telas/metricas';
import { telaPerfil, telaAcessibilidade } from './telas/perfil';
import { telaPrivacidade, telaExportar, telaExcluirConta } from './telas/privacidade';

// Inventário de telas (seção 8): 01 carregamento está no index.html
rota('login', telaLogin, { publica: true, titulo: 'Entrar' });                       // 02
rota('cadastro', telaCadastro, { publica: true, titulo: 'Criar conta' });            // 03
rota('recuperar', telaRecuperar, { publica: true, titulo: 'Recuperar senha' });      // 04
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
