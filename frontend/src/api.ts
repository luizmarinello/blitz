/// <reference types="vite/client" />
// Cliente da API. Sessão por cookie; erros vêm como {mensagem, campos?}.
// VITE_API_URL = origem do back quando o front é publicado separado (Render Static Site); vazio = mesma origem/proxy.
const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');

export type Prioridade = 'BAIXA' | 'MEDIA' | 'ALTA';
export type Status = 'BACKLOG' | 'EM_ANDAMENTO' | 'CONCLUIDA';
export type Tema = 'CLARO' | 'ESCURO' | 'ALTO_CONTRASTE';
export type TamanhoFonte = 'PEQUENO' | 'MEDIO' | 'GRANDE';

export interface Usuario { id: number; nome: string; email: string; papel: string }
export interface Lista { id: number; nome: string; posicao: number }
export interface Tarefa {
  id: number; listaId: number; sprintId?: number; titulo: string; descricao?: string; prioridade: Prioridade;
  horasEstimadas?: number; prazo?: string; status: Status; posicao: number; concluidaEm?: string; criadoEm: string;
}
export interface TarefaEntrada {
  titulo: string; descricao?: string; prioridade: Prioridade; prazo?: string | null;
  horasEstimadas?: number | null; status?: Status; listaId?: number;
}
export interface Modo { id: number; usuarioId?: number; nome: string; descricao?: string; cicloFocoMin: number; cicloPausaMin: number; predefinido: boolean }
export interface Sessao { id: number; tarefaId?: number; modoId: number; inicio: string; fim?: string; duracaoSegundos?: number }
export interface Metricas {
  hojeSegundos: number; semanaSegundos: number; porDia: { dia: string; segundos: number }[];
  totalSessoes: number; sessoesSemana: number; mediaSessaoSemanaSegundos: number; tarefasConcluidas: number;
}
export interface Prefs { tema: Tema; tamanhoFonte: TamanhoFonte; reduzirAnimacoes: boolean; leitorTela: boolean }
export interface LimiteIa { usados: number; maximo: number; renovaEm: string; configurado: boolean }
export interface RespostaIa { resposta: string; tokensUsados: number; fallback: boolean; limite: LimiteIa }
export interface Conversa { id: number; mensagem: string; resposta?: string; dataHora: string }
export interface Consentimento { id: number; versaoPolitica: string; aceitoEm: string; canal: string; finalidade: string }
export interface Sprint { id: number; dataInicio: string; dataFim: string; geradaPorIa: boolean }
export interface SprintAtual { sprint: Sprint; tarefas: number; horasPlanejadas: number }
export interface Planejamento extends SprintAtual { foraDaSprint: number }
export type Papel = 'USUARIO' | 'GESTOR' | 'ADMINISTRADOR';
export interface UsuarioAdmin { id: number; nome: string; email: string; papel: Papel; ativo: boolean; organizacaoId?: number; criadoEm: string; anonimizadoEm?: string }
export interface Organizacao { id: number; nome: string; licencasTotais: number; criadoEm: string }
export interface MetricasOrg { organizacao_id: number; organizacao: string; colaboradores: number; media_minutos_por_sessao?: number; total_sessoes: number }
export interface MetricasAdmin {
  usuarios: number; usuariosAtivos: number; usuariosAnonimizados: number; sessoes: number; minutosFoco: number;
  tarefas: number; tarefasConcluidas: number; conversasIa30Dias: number; tokensIa30Dias: number; organizacoes: MetricasOrg[];
}
export interface Integracoes {
  ia: { provedor: string; modelo: string; configurado: boolean; limiteTokensDia: number };
  email: { provedor: string; configurado: boolean; host: string };
}
export interface MetricasGestor { semOrganizacao?: boolean; organizacao?: string; colaboradores?: number; metricas?: MetricasOrg | null }

export class ApiErro extends Error {
  constructor(public status: number, mensagem: string, public campos: Record<string, string> = {}, public corpo: unknown = null) {
    super(mensagem);
  }
}

async function chamar<T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BASE + caminho, {
      method: metodo,
      headers: corpo === undefined ? {} : { 'Content-Type': 'application/json' },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      credentials: 'include',
    });
  } catch {
    throw new ApiErro(0, 'Sem conexão com o servidor. Verifique sua internet e tente de novo.');
  }
  if (res.status === 204) return undefined as T;
  const texto = await res.text();
  const dados = texto ? JSON.parse(texto) : undefined;
  if (!res.ok) {
    const msg = dados?.mensagem ?? (res.status >= 500 ? 'Erro interno. Tente novamente em instantes.' : 'Não foi possível concluir.');
    throw new ApiErro(res.status, msg, dados?.campos ?? {}, dados);
  }
  return dados as T;
}

/** Baixa um arquivo autenticado da API. Link direto não serve: o front e a API são origens diferentes (o cookie e o atributo download não cruzam). */
export async function baixar(caminho: string, nomeArquivo: string) {
  const res = await fetch(BASE + caminho, { credentials: 'include' });
  if (!res.ok) throw new ApiErro(res.status, res.status === 401 ? 'Sessão expirada. Entre de novo.' : 'Não foi possível gerar o arquivo.');
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement('a'), { href: url, download: nomeArquivo });
  a.click();
  URL.revokeObjectURL(url);
}

export const api = {
  // UC01
  me: () => chamar<Usuario>('GET', '/api/auth/me'),
  login: (email: string, senha: string) => chamar<Usuario>('POST', '/api/auth/login', { email, senha }),
  cadastro: (nome: string, email: string, senha: string, aceitaTermos: boolean) =>
    chamar<Usuario>('POST', '/api/auth/cadastro', { nome, email, senha, aceitaTermos }),
  logout: () => chamar<void>('POST', '/api/auth/logout'),
  recuperar: (email: string) => chamar<{ mensagem: string }>('POST', '/api/auth/recuperar', { email }),
  redefinir: (token: string, novaSenha: string) => chamar<{ mensagem: string }>('POST', '/api/auth/redefinir', { token, novaSenha }),

  // UC02
  listas: () => chamar<Lista[]>('GET', '/api/listas'),
  criarLista: (nome: string) => chamar<Lista>('POST', '/api/listas', { nome }),
  renomearLista: (id: number, nome: string) => chamar<Lista>('PUT', `/api/listas/${id}`, { nome }),
  excluirLista: (id: number) => chamar<void>('DELETE', `/api/listas/${id}`),
  tarefas: () => chamar<Tarefa[]>('GET', '/api/tarefas'),
  tarefa: (id: number) => chamar<Tarefa>('GET', `/api/tarefas/${id}`),
  criarTarefa: (listaId: number, t: TarefaEntrada) => chamar<Tarefa>('POST', `/api/listas/${listaId}/tarefas`, t),
  editarTarefa: (id: number, t: TarefaEntrada) => chamar<Tarefa>('PUT', `/api/tarefas/${id}`, t),
  mudarStatus: (id: number, status: Status) => chamar<Tarefa>('PATCH', `/api/tarefas/${id}/status`, { status }),
  excluirTarefa: (id: number) => chamar<void>('DELETE', `/api/tarefas/${id}`),

  // UC05
  modos: () => chamar<Modo[]>('GET', '/api/modos'),
  criarModo: (m: Omit<Modo, 'id' | 'predefinido' | 'usuarioId'>) => chamar<Modo>('POST', '/api/modos', m),
  editarModo: (id: number, m: Omit<Modo, 'id' | 'predefinido' | 'usuarioId'>) => chamar<Modo>('PUT', `/api/modos/${id}`, m),
  excluirModo: (id: number) => chamar<void>('DELETE', `/api/modos/${id}`),

  // UC03
  sessaoAtiva: () => chamar<Sessao | undefined>('GET', '/api/sessoes/ativa'),
  iniciarSessao: (modoId: number, tarefaId?: number) => chamar<Sessao>('POST', '/api/sessoes', { modoId, tarefaId: tarefaId ?? null }),
  encerrarSessao: (id: number, segundosAtivos: number) => chamar<Sessao>('POST', `/api/sessoes/${id}/encerrar`, { segundosAtivos }),
  descartarSessao: (id: number) => chamar<void>('DELETE', `/api/sessoes/${id}`),
  sessoes: () => chamar<Sessao[]>('GET', '/api/sessoes'),
  metricas: () => chamar<Metricas>('GET', '/api/metricas'),

  // UC04
  iaMensagem: (mensagem: string) => chamar<RespostaIa>('POST', '/api/ia/mensagem', { mensagem }),
  iaHistorico: () => chamar<Conversa[]>('GET', '/api/ia/historico'),
  iaLimite: () => chamar<LimiteIa>('GET', '/api/ia/limite'),

  // UC12
  prefs: () => chamar<Prefs>('GET', '/api/acessibilidade'),
  salvarPrefs: (p: Prefs) => chamar<Prefs>('PUT', '/api/acessibilidade', p),

  // Perfil / UC11
  renomear: (nome: string) => chamar<Usuario>('PUT', '/api/perfil', { nome }),
  trocarSenha: (atual: string, nova: string) => chamar<void>('PUT', '/api/perfil/senha', { atual, nova }),
  consentimentos: () => chamar<Consentimento[]>('GET', '/api/privacidade/consentimentos'),
  excluirConta: (senha: string) => chamar<{ mensagem: string }>('DELETE', '/api/privacidade/conta', { senha }),

  // RF09 sprints
  sprintAtual: () => chamar<SprintAtual | undefined>('GET', '/api/sprints/atual'),
  planejarSprint: (capacidadeHoras: number) => chamar<Planejamento>('POST', '/api/sprints/planejar', { capacidadeHoras }),

  // UC06–UC10 admin / RF21 gestor
  adminUsuarios: () => chamar<UsuarioAdmin[]>('GET', '/api/admin/usuarios'),
  adminAlterarUsuario: (id: number, p: { papel?: Papel; ativo?: boolean; organizacaoId?: number | null }) =>
    chamar<UsuarioAdmin>('PATCH', `/api/admin/usuarios/${id}`, { papel: p.papel, ativo: p.ativo, organizacaoId: p.organizacaoId ?? undefined, limparOrganizacao: p.organizacaoId === null }),
  adminOrganizacoes: () => chamar<Organizacao[]>('GET', '/api/admin/organizacoes'),
  adminCriarOrganizacao: (nome: string, licencasTotais: number) => chamar<Organizacao>('POST', '/api/admin/organizacoes', { nome, licencasTotais }),
  adminMetricas: () => chamar<MetricasAdmin>('GET', '/api/admin/metricas'),
  adminIntegracoes: () => chamar<Integracoes>('GET', '/api/admin/integracoes'),
  gestorMetricas: () => chamar<MetricasGestor>('GET', '/api/gestor/metricas'),
};
