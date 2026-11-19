# Documentos da Sprint 6 (Testes, homologação e entrega, 23/09 a 07/10), um por cartão do Trello.
# Revisados um a um com o Luiz: o que estiver entre [colchetes] ainda depende da confirmação dele.
# Uso: python docs/sprint6/gerar_sprint6.py
import html, pathlib, subprocess, tempfile

PASTA = pathlib.Path(__file__).parent / "pdf"
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
EQUIPE = "Luiz Henrique Marinello da Rosa, Vinicius Fagundes e Raphael Gomes Henke"

CSS = """
@page { size: A4; margin: 18mm 16mm; }
body { font-family: "Segoe UI", Arial, sans-serif; color: #16181D; font-size: 10.5pt; line-height: 1.45; }
.marca { font-weight: 700; color: #1D4ED8; } h1 { font-size: 18pt; margin: 2px 0; } .sub { color: #5B616E; margin: 0 0 12px; }
h2 { font-size: 12.5pt; color: #1D4ED8; margin: 16px 0 4px; } h3 { font-size: 11pt; margin: 10px 0 2px; }
table { border-collapse: collapse; width: 100%; margin: 6px 0 8px; font-size: 9.5pt; } th, td { border: 1px solid #E2E4E9; padding: 4px 6px; vertical-align: top; text-align: left; }
th { background: #EEF2FB; } ul { margin: 2px 0; padding-left: 18px; } .pend { color: #96590A; font-weight: 600; }
tr { page-break-inside: avoid; } td:first-child { white-space: nowrap; }
"""

def esc(s):  # destaca o que ainda precisa de confirmação
    return html.escape(s).replace("[", '<span class="pend">[').replace("]", "]</span>")

def tabela(cab, linhas):
    th = "".join(f"<th>{esc(c)}</th>" for c in cab)
    trs = "".join("<tr>" + "".join(f"<td>{esc(str(v))}</td>" for v in l) + "</tr>" for l in linhas)
    return f"<table><tr>{th}</tr>{trs}</table>"

def lista(itens):
    return "<ul>" + "".join(f"<li>{esc(i)}</li>" for i in itens) + "</ul>"

# ---------------------------------------------------------------- cartão 1: plano de testes
CASOS = [
    ("CT-01", "UC01", "Cadastro com aceite dos Termos e da Política", "Preencher nome, e-mail e senha; marcar o aceite; criar conta.", "Conta criada e consentimento gravado com data, hora e versão da política.", "RF01, RF-LGPD01, RNF-LGPD06"),
    ("CT-02", "UC01", "Cadastro sem aceite", "Preencher os dados sem marcar o aceite e enviar.", "Cadastro bloqueado, com mensagem clara pedindo o aceite.", "RF-LGPD01, RF04"),
    ("CT-03", "UC01", "Login com credenciais válidas", "Informar e-mail e senha cadastrados.", "Acesso ao painel principal.", "RF02, RN01"),
    ("CT-04", "UC01", "Login com senha incorreta", "Informar e-mail válido e senha errada.", "Mensagem clara, sem revelar se o e-mail existe; continua na tela de login.", "RF02, RF04"),
    ("CT-05", "UC01", "Recuperação de senha", "Pedir redefinição pelo e-mail; abrir o link; definir nova senha; entrar.", "Senha trocada; a senha antiga deixa de funcionar.", "RF03"),
    ("CT-06", "UC02", "Criar lista e tarefa completa", "Criar lista; cadastrar tarefa com título, descrição, prioridade, prazo e horas.", "Tarefa aparece na coluna A fazer com todos os campos.", "RF05, RF06"),
    ("CT-07", "UC02", "Mover tarefa entre colunas (mouse e teclado)", "Arrastar o cartão; repetir usando só o teclado.", "Status atualizado nos dois casos; foco visível o tempo todo.", "RF07, US-02, RA02"),
    ("CT-08", "UC02", "Concluir tarefa", "Mover tarefa para Concluída.", "Tarefa fica no histórico com data de conclusão.", "RN02, RF08"),
    ("CT-09", "UC02", "Organização automática em sprint", "Informar horas disponíveis na semana e pedir o planejamento.", "Tarefas distribuídas na sprint da semana até a capacidade informada.", "RF09"),
    ("CT-10", "UC03", "Iniciar, pausar e encerrar sessão de foco", "Iniciar sessão, pausar, retomar e encerrar.", "Duração registrada sem contar o tempo em pausa.", "RF10, RF11"),
    ("CT-11", "UC05", "Usar um modo de concentração", "Escolher Pomodoro, Profundo e Relax em sessões diferentes.", "Ciclos de foco e pausa de cada modo aplicados.", "RF12, RN05"),
    ("CT-12", "UC05", "Modo personalizado", "Criar, editar e excluir um modo; tentar excluir um modo já usado em sessão.", "CRUD funciona; exclusão de modo com histórico é bloqueada com explicação.", "RF13"),
    ("CT-13", "UC03", "Métricas após a sessão", "Encerrar uma sessão e abrir Métricas.", "Tempo de foco do dia e da semana atualizados.", "RF14, RN03"),
    ("CT-14", "UC03", "Excluir tarefa com tempo de foco", "Excluir uma tarefa que já teve sessão.", "Tempo continua nas métricas, desvinculado da tarefa.", "RN03"),
    ("CT-15", "UC04", "Pedir sugestão de prioridade à IA", "Perguntar ao assistente o que fazer agora.", "Resposta com ordem sugerida baseada em prazo, prioridade e esforço.", "RF15, RF16"),
    ("CT-16", "UC04", "IA indisponível", "Simular falha do provedor de IA e perguntar de novo.", "Resposta alternativa automática, sem erro na tela.", "RF17"),
    ("CT-17", "UC04", "Limite de uso da IA", "Atingir o limite diário de uso do assistente.", "Mensagem informa quando renova; o resto do app segue funcionando.", "RNF09"),
    ("CT-18", "UC11", "Exportar dados pessoais", "Em Privacidade e dados, exportar os dados.", "Arquivo com os dados da conta é baixado.", "RF-LGPD03"),
    ("CT-19", "UC11", "Excluir conta", "Pedir a exclusão e confirmar.", "Dados apagados ou anonimizados e sessão encerrada.", "RF-LGPD04"),
    ("CT-20", "UC12", "Preferências de acessibilidade", "Trocar tema, tamanho de fonte, alto contraste e reduzir animações; navegar por várias telas.", "Preferências valem em todas as telas sem quebrar o layout.", "RA04, RA05, RA06, RN08"),
    ("CT-21", "UC06 a UC10", "Acesso do administrador", "Entrar como administrador e como usuário comum e abrir a área de administração.", "Administrador acessa usuários e métricas; usuário comum é barrado.", "RF18, RF19, RN04"),
    ("CT-22", "UC06 a UC10", "Visão do gestor", "Entrar como gestor de uma equipe com menos de 5 pessoas e com 5 ou mais.", "Gestor vê só a própria equipe; com menos de 5 pessoas as métricas não aparecem.", "RF21"),
]

def plano_testes():
    return f"""
<div class="marca">BLITZ · TCC Equipe T03N</div>
<h1>Plano de testes e casos de teste</h1>
<p class="sub">Sprint 6 - Testes, homologação e entrega (23/09 a 07/10/2026) · Responsável: Luiz Henrique Marinello da Rosa · Versão 1.0, 25/09/2026</p>
<h2>1. Objetivo</h2>
<p>{esc("Definir como o Blitz será testado antes da entrega: o que será verificado, com qual método, em qual ambiente, por quem e com quais critérios para considerar a fase de testes encerrada.")}</p>
<h2>2. Escopo</h2>
{lista(["Funcional: casos de uso UC01 a UC12, com os casos de teste da seção 7.",
        "Acessibilidade: requisitos RA01 a RA08 (WCAG 2.1 nível AA e eMAG).",
        "Usabilidade: sessões com usuários do público B2C e questionário SUS.",
        "Fora do escopo: testes de carga, empacotamento desktop (Electron) e aplicativos nativos."])}
<h2>3. Estratégia e cronograma</h2>
{tabela(["Tipo de teste", "Método", "Responsável", "Data"], [
    ["Funcional", "Execução manual dos casos CT-01 a CT-22, com registro do resultado de cada um", "Vinicius Fagundes", "29/09"],
    ["Acessibilidade", "Ferramenta automática de auditoria em todas as telas + verificação manual de teclado, foco visível, leitor de tela, contraste e ampliação de fonte em 200%", "Raphael Gomes Henke", "30/09"],
    ["Usabilidade", "Sessões individuais de cerca de 20 minutos com tarefas propostas, observação sem intervenção e questionário SUS", "Raphael Gomes Henke", "01/10"],
    ["Correção e reteste", "Correção dos defeitos priorizados por severidade e reteste do caso de origem", "Vinicius Fagundes", "até 03/10"],
])}
<h2>4. Ambiente e massa de dados</h2>
{lista(["Ambiente de homologação: aplicação da branch main (back-end Java 21 + Spring Boot e front-end TypeScript + Vite), executada localmente.",
        "Navegador: Google Chrome, versão atual. Firefox, Edge e Safari (RNF03) ficam fora desta rodada.",
        "Massa de dados: contas de teste com papel de usuário, gestor e administrador; listas e tarefas com prazos vencidos, do dia e futuros; sessões de foco registradas."])}
<h2>5. Critérios de entrada e de saída</h2>
<h3>Entrada</h3>{lista(["Casos de teste escritos e revisados por outro integrante.", "Ambiente de homologação disponível e massa de dados carregada."])}
<h3>Saída</h3>{lista(["100% dos casos de teste executados e registrados.",
        "Nenhum defeito de severidade alta em aberto.",
        "Nenhuma violação de acessibilidade de nível A ou AA nas telas principais (login, painel, sessão de foco).",
        "Pelo menos 5 participantes no teste de usabilidade, com a pontuação SUS registrada."])}
<h2>6. Registro de defeitos</h2>
<p>{esc("Cada defeito vira um cartão na lista \"Impedimentos e Defeitos\" do Trello, no formato do cartão MODELO: título [BUG], severidade, caso de teste de origem, caso de uso afetado, ambiente, passos, resultado esperado, resultado obtido e evidência.")}</p>
{tabela(["Severidade", "Critério", "Tratamento"], [
    ["Alta", "Impede uma funcionalidade principal ou viola requisito legal (LGPD ou acessibilidade)", "Correção obrigatória na Sprint 6"],
    ["Média", "Existe contorno, mas atrapalha o uso", "Correção na Sprint 6 se houver capacidade"],
    ["Baixa", "Ajuste cosmético", "Vai para o backlog do produto"],
])}
<h2>7. Casos de teste</h2>
{tabela(["ID", "UC", "Caso", "Passos", "Resultado esperado", "Requisitos"], CASOS)}
<h2>8. Matriz de rastreabilidade (caso de uso → casos de teste)</h2>
{tabela(["Caso de uso", "Casos de teste"], [
    ["UC01 Fazer login (e aceitar termos)", "CT-01 a CT-05"], ["UC02 Listas e tarefas", "CT-06 a CT-09"],
    ["UC03 Tempo de foco", "CT-10, CT-13, CT-14"], ["UC04 Assistente de IA", "CT-15 a CT-17"],
    ["UC05 Modos de concentração", "CT-11, CT-12"], ["UC06 a UC10 Administração", "CT-21, CT-22"],
    ["UC11 Consentimento e dados pessoais", "CT-01, CT-02, CT-18, CT-19"], ["UC12 Acessibilidade", "CT-07, CT-20 e relatório de acessibilidade"],
])}
"""

# ---------------------------------------------------------------- cartão 2: testes funcionais
# Confirmado pelo Luiz (19/11): só o CT-05 falhou (e-mail de recuperação não chegava, SMTP não configurado), severidade média,
# corrigido até 03/10 configurando o SMTP no ambiente local; a produção (Render) nunca recebeu essa configuração.
def relatorio_funcional():
    linhas = []
    for ct, uc, caso, *_ in CASOS:
        if ct == "CT-05":
            linhas.append([ct, uc, caso, "Reprovado em 29/09; aprovado no reteste de 03/10", "Defeito D-01: o e-mail com o link de redefinição não chegava."])
        else:
            linhas.append([ct, uc, caso, "Aprovado", ""])
    return f"""
<div class="marca">BLITZ · TCC Equipe T03N</div>
<h1>Relatório de execução dos testes funcionais</h1>
<p class="sub">Sprint 6 - Testes, homologação e entrega · Responsável: Vinicius Fagundes · Execução em 29/09/2026 · Reteste em 03/10/2026</p>
<h2>1. Resumo</h2>
{tabela(["Item", "Resultado"], [
    ["Casos de teste planejados", "22 (CT-01 a CT-22, plano de testes de 25/09)"],
    ["Casos executados", "22 (100%)"],
    ["Aprovados na primeira execução", "21"],
    ["Reprovados na primeira execução", "1 (CT-05)"],
    ["Defeitos encontrados", "1, severidade média"],
    ["Situação após o reteste de 03/10", "22 aprovados, nenhum defeito em aberto"],
])}
<h2>2. Ambiente</h2>
{lista(["Aplicação da branch main (back-end Java 21 + Spring Boot e front-end TypeScript + Vite), executada localmente.",
        "Navegador: Google Chrome, versão atual.",
        "Massa de dados: contas de teste com papel de usuário, gestor e administrador, listas e tarefas com prazos variados e sessões de foco registradas."])}
<h2>3. Resultado por caso de teste</h2>
{tabela(["ID", "UC", "Caso", "Resultado", "Observação"], linhas)}
<h2>4. Defeitos encontrados</h2>
<h3>D-01 · Recuperação de senha não envia o e-mail</h3>
{tabela(["Campo", "Registro"], [
    ["Severidade", "Média: a pessoa não consegue redefinir a senha sozinha, mas o restante do sistema funciona."],
    ["Caso de teste de origem", "CT-05"],
    ["Caso de uso e requisito", "UC01 · RF03 (recuperação de senha)"],
    ["Ambiente", "Aplicação local da branch main, Google Chrome"],
    ["Passos para reproduzir", "1. Na tela de login, clicar em \"Esqueci minha senha\". 2. Informar o e-mail de uma conta de teste. 3. Aguardar o e-mail com o link de redefinição."],
    ["Resultado esperado", "Receber o e-mail com o link, definir nova senha e entrar com ela."],
    ["Resultado obtido", "O pedido é aceito, mas o e-mail não chega."],
    ["Causa", "O servidor de e-mail (SMTP) não estava configurado no ambiente de teste."],
    ["Correção", "SMTP configurado no ambiente local (cartão \"Correção dos defeitos encontrados na homologação\")."],
    ["Reteste", "03/10/2026, por Vinicius Fagundes: e-mail recebido, senha redefinida e login com a nova senha. Aprovado."],
    ["Observação", "A configuração de e-mail vale só para o ambiente local. Quando o sistema for publicado, ela precisa ser repetida no servidor de produção."],
])}
<h2>5. Critérios de saída</h2>
{tabela(["Critério do plano", "Situação"], [
    ["100% dos casos de teste executados e registrados", "Atendido"],
    ["Nenhum defeito de severidade alta em aberto", "Atendido (nenhum defeito de severidade alta encontrado)"],
])}
"""

# ---------------------------------------------------------------- cartão 3: acessibilidade
# Confirmado pelo Luiz (19/11): Lighthouse + teclado; achado de contraste (âmbar #B26B00 = 4.20:1), corrigido até 03/10.
TELAS = ["Login", "Cadastro", "Painel (quadro)", "Detalhe da tarefa", "Modos de concentração", "Sessão de foco", "Assistente", "Métricas", "Acessibilidade", "Privacidade e dados"]

def relatorio_acessibilidade():
    return f"""
<div class="marca">BLITZ · TCC Equipe T03N</div>
<h1>Relatório de testes de acessibilidade</h1>
<p class="sub">Sprint 6 - Testes, homologação e entrega · Responsável: Raphael Gomes Henke · Execução em 30/09/2026 · Referência: WCAG 2.1 nível AA e eMAG</p>
<h2>1. Resumo</h2>
{tabela(["Item", "Resultado"], [
    ["Telas auditadas", f"{len(TELAS)}: " + ", ".join(TELAS)],
    ["Verificação automática", "Lighthouse (Google Chrome), categoria Acessibilidade, em todas as telas"],
    ["Verificação manual", "Navegação completa por teclado"],
    ["Não conformidades encontradas", "1: contraste insuficiente da cor âmbar (atenção e prioridade média)"],
    ["Situação em 03/10", "Corrigida e verificada novamente; nenhuma não conformidade em aberto"],
])}
<h2>2. Ambiente</h2>
{lista(["Aplicação da branch main executada localmente.", "Navegador: Google Chrome, versão atual, com o Lighthouse do DevTools.", "Temas verificados: claro, escuro e alto contraste."])}
<h2>3. Verificação por requisito</h2>
{tabela(["Requisito", "Como foi verificado", "Resultado"], [
    ["RA01 Contraste (4.5:1 texto, 3:1 gráficos)", "Lighthouse nas telas auditadas, nos três temas", "Não conforme na primeira execução (âmbar); conforme após a correção"],
    ["RA02 Teclado e foco visível", "Navegação manual com Tab, Shift+Tab, Enter, Espaço e Esc em todas as telas, incluindo mover tarefas no quadro e diálogos", "Conforme: todas as ações alcançáveis por teclado, ordem de foco lógica e foco visível"],
    ["RA03 Semântica e ARIA", "Lighthouse (nomes acessíveis, rótulos de campos, estrutura de títulos)", "Conforme"],
    ["RA05 Tema de alto contraste", "Lighthouse com o tema de alto contraste ativo", "Conforme"],
    ["RA08 Texto alternativo", "Lighthouse (imagens com texto alternativo)", "Conforme"],
])}
<h2>4. Não conformidade encontrada</h2>
<h3>A-01 · Cor âmbar abaixo do contraste mínimo</h3>
{tabela(["Campo", "Registro"], [
    ["Critério WCAG", "1.4.3 Contraste mínimo (nível AA) · RA01"],
    ["Onde aparece", "Texto e etiquetas na cor âmbar: avisos de atenção e prioridade média, no tema claro"],
    ["Medição", "Âmbar #B26B00 sobre fundo branco: 4.20:1 (mínimo exigido: 4.5:1)"],
    ["Severidade", "Alta pelo critério do plano (viola requisito de acessibilidade)"],
    ["Correção", "Token de cor trocado para #96590A: 5.63:1 sobre o fundo e 5.10:1 sobre a superfície"],
    ["Verificação", "03/10/2026: Lighthouse sem apontamentos de contraste nas telas auditadas"],
])}
<h2>5. Não realizado nesta rodada</h2>
{lista(["Teste com leitor de tela (NVDA) nas telas de login, quadro e sessão de foco.",
        "Ampliação de fonte a 200% em todas as telas.",
        "Verificação da opção de reduzir animações (RA06).",
        "Esses itens estavam previstos no plano de testes e ficam como pendência para a próxima rodada de testes."])}
<h2>6. Critério de saída</h2>
{tabela(["Critério do plano", "Situação"], [
    ["Nenhuma violação de nível A ou AA nas telas principais", "Atendido na verificação automática e de teclado; leitor de tela, ampliação a 200% e RA06 pendentes"],
])}
"""

# ---------------------------------------------------------------- cartão 4: usabilidade
# Confirmado pelo Luiz (19/11): 5 participantes (3 estudantes, 2 trabalhadores híbridos), presenciais, todos concluíram as
# 5 tarefas, SUS não aplicado; dificuldades: achar onde criar tarefa, entender os modos de foco, achar as preferências.
def relatorio_usabilidade():
    return f"""
<div class="marca">BLITZ · TCC Equipe T03N</div>
<h1>Relatório do teste de usabilidade</h1>
<p class="sub">Sprint 6 - Testes, homologação e entrega · Responsável: Raphael Gomes Henke · Sessões em 01/10/2026</p>
<h2>1. Resumo</h2>
{tabela(["Item", "Resultado"], [
    ["Participantes", "5 pessoas do público B2C: 3 estudantes e 2 trabalhadores híbridos (identificados como P1 a P5)"],
    ["Formato", "Sessões individuais e presenciais, de cerca de 20 minutos, com observação sem intervenção"],
    ["Tarefas concluídas", "5 de 5 tarefas por todos os participantes"],
    ["Dificuldades observadas", "3 pontos de atrito, descritos na seção 4"],
    ["Questionário SUS", "Não aplicado nesta rodada"],
])}
<h2>2. Ambiente</h2>
{lista(["Aplicação da branch main executada localmente, no Google Chrome.", "Cada participante criou a própria conta de teste durante a sessão."])}
<h2>3. Tarefas propostas</h2>
{tabela(["Tarefa", "Caso de uso", "Concluída por"], [
    ["T1. Criar uma conta", "UC01", "5 de 5"],
    ["T2. Cadastrar três atividades", "UC02", "5 de 5"],
    ["T3. Iniciar uma sessão de foco", "UC03, UC05", "5 de 5"],
    ["T4. Pedir uma sugestão ao assistente de IA", "UC04", "5 de 5"],
    ["T5. Alterar as preferências de acessibilidade", "UC12", "5 de 5"],
])}
<h2>4. Dificuldades observadas e encaminhamento</h2>
{tabela(["Dificuldade", "Tarefa", "Severidade", "Encaminhamento"], [
    ["Demora para encontrar onde criar a primeira lista e a primeira tarefa", "T2", "Média", "Melhoria no backlog: orientar o primeiro uso no quadro vazio"],
    ["Dúvida sobre a diferença entre os modos Pomodoro, Profundo e Relax", "T3", "Média", "Melhoria no backlog: deixar claro o que cada modo muda na sessão"],
    ["Dificuldade para encontrar tema, fonte e acessibilidade no menu da conta", "T5", "Baixa", "Melhoria no backlog: dar mais visibilidade às preferências"],
])}
<p>{esc("Nenhuma dificuldade impediu a conclusão das tarefas, por isso nenhuma foi classificada como alta. As três seguem para o backlog do produto, conforme o critério de severidade do plano de testes.")}</p>
<h2>5. Critérios de aceitação do cartão</h2>
{tabela(["Critério", "Situação"], [
    ["Pelo menos 5 participantes", "Atendido (5)"],
    ["Pontuação SUS registrada", "Não atendido: o questionário não foi aplicado"],
    ["Lista de melhorias priorizadas", "Atendido (seção 4)"],
])}
"""

# ---------------------------------------------------------------- cartão 5: correção dos defeitos
# Confirmado pelo Luiz (19/11): 2 defeitos (D-01 e-mail, A-01 contraste), ambos corrigidos por Vinicius; Raphael
# verificou o contraste de novo; usabilidade foi para o backlog por falta de capacidade antes da entrega de 07/10.
def relatorio_correcoes():
    return f"""
<div class="marca">BLITZ · TCC Equipe T03N</div>
<h1>Relatório de correção dos defeitos da homologação</h1>
<p class="sub">Sprint 6 - Testes, homologação e entrega · Responsável: Vinicius Fagundes · Concluído em 03/10/2026</p>
<h2>1. Resumo</h2>
{tabela(["Item", "Resultado"], [
    ["Defeitos recebidos dos testes", "2 (1 do teste funcional e 1 do teste de acessibilidade)"],
    ["Defeitos corrigidos e retestados", "2"],
    ["Defeitos de severidade alta em aberto", "0"],
    ["Melhorias de usabilidade encaminhadas ao backlog", "3 (2 médias e 1 baixa)"],
])}
<h2>2. Defeitos corrigidos</h2>
{tabela(["ID", "Origem", "Defeito", "Severidade", "Correção", "Reteste"], [
    ["D-01", "Teste funcional, CT-05 (29/09)", "Recuperação de senha não enviava o e-mail com o link", "Média",
     "Servidor de e-mail (SMTP) configurado no ambiente local", "03/10, Vinicius Fagundes: e-mail recebido e senha redefinida. Aprovado."],
    ["A-01", "Teste de acessibilidade (30/09)", "Cor âmbar #B26B00 com contraste de 4.20:1, abaixo do mínimo de 4.5:1 (WCAG 1.4.3, RA01)", "Alta",
     "Token de cor trocado para #96590A (5.63:1 sobre o fundo e 5.10:1 sobre a superfície)", "03/10, Raphael Gomes Henke: Lighthouse sem apontamentos de contraste. Aprovado."],
])}
<h2>3. Melhorias encaminhadas ao backlog</h2>
<p>{esc("As dificuldades do teste de usabilidade não impediram nenhuma tarefa. O plano previa corrigir as de severidade média se houvesse capacidade; como a prioridade da sprint era a entrega de 07/10, as três foram para o backlog do produto.")}</p>
{tabela(["Melhoria", "Severidade", "Origem"], [
    ["Orientar o primeiro uso para criar a primeira lista e tarefa", "Média", "Teste de usabilidade, tarefa T2"],
    ["Deixar claro o que cada modo de concentração muda na sessão", "Média", "Teste de usabilidade, tarefa T3"],
    ["Dar mais visibilidade às preferências de tema, fonte e acessibilidade", "Baixa", "Teste de usabilidade, tarefa T5"],
])}
<h2>4. Observação para a publicação</h2>
<p>{esc("A correção do D-01 foi feita no ambiente local. Quando o sistema for publicado, o servidor de e-mail precisa ser configurado também no ambiente de produção.")}</p>
<h2>5. Critérios de aceitação do cartão</h2>
{tabela(["Critério", "Situação"], [
    ["Nenhum defeito de severidade alta em aberto", "Atendido"],
    ["Cada correção com reteste registrado", "Atendido (seção 2)"],
    ["Defeitos de severidade baixa no backlog", "Atendido (seção 3)"],
])}
"""

# ---------------------------------------------------------------- cartão 7: índice da entrega final
# Confirmado pelo Luiz (19/11): entrega em 07/10 de 6 dos 7 itens; monografia pendente, sem data;
# requisitos v2.0 entregue, mas o arquivo ainda precisa ser anexado ao cartão "Documento Requisitos".
def indice_entrega():
    return f"""
<div class="marca">BLITZ · TCC Equipe T03N</div>
<h1>Índice da documentação da entrega final</h1>
<p class="sub">Sprint 6 - Testes, homologação e entrega · Responsável: Luiz Henrique Marinello da Rosa · Entrega em 07/10/2026</p>
<h2>1. Situação da entrega</h2>
{tabela(["Item da checklist", "Situação em 07/10"], [
    ["Documento de requisitos v2.0 (com LGPD e acessibilidade)", "Entregue"],
    ["Documentação de casos de uso v2.0 (UC01 a UC12)", "Entregue"],
    ["Diagramas atualizados: casos de uso, atividades e classes", "Entregue"],
    ["Canvas e pesquisas: mercado, B2C, B2B, portabilidade e cores", "Entregue"],
    ["Manual do usuário e registro das dailies", "Entregue"],
    ["Plano e relatórios de testes (funcional, acessibilidade e usabilidade)", "Entregue"],
    ["Monografia formatada conforme as normas da instituição", "Pendente: não entregue em 07/10, sem data definida"],
])}
<h2>2. Onde está cada documento no quadro do projeto</h2>
{tabela(["Documento", "Arquivo", "Cartão (lista)"], [
    ["Documento de requisitos v2.0", "Documento_de_Requisitos_BLITZ_v2 [arquivo a anexar no cartão]", "Documento Requisitos (Sprint 2)"],
    ["Documentação de casos de uso v2.0", "S3_Documentacao-Casos-de-Uso_Casos-de-Uso-v2.pdf", "Documentação Casos de Uso (Sprint 3)"],
    ["Diagrama de casos de uso", "Diagrama.png; Documentacao_Casos_de_Uso_BLITZ_v2.pdf", "Diagrama Casos de Uso (Sprint 3); Atualizar diagrama de casos de uso (Sprint 5)"],
    ["Diagramas de atividades", "S4_Diagramas-UML_v1-Documento-Completo.pdf; S4_Diagrama-de-Atividades_Fluxo1-Autenticacao.png", "Diagrama de atividades (Sprint 4)"],
    ["Diagrama de classes", "Diagrama Classes.png; S5_Itens-Acessibilidade_Diagrama-Classes-v2.png", "Diagrama de Classes (Sprint 4); Itens de acessibilidade no diagrama de classes (Sprint 5)"],
    ["Business Model Canvas", "CANVAS.png", "Canvas (Sprint 2)"],
    ["Pesquisa de mercado", "Relatorio_Pesquisa_de_Mercado_BLITZ_1.pdf", "Pesquisa de mercado (Sprint 2)"],
    ["Necessidades B2C e B2B", "Relatorio_Necessidades_B2C_BLITZ.pdf; Relatorio_Necessidades_B2B_BLITZ.pdf", "Necessidades B2C e B2B (Sprint 1)"],
    ["Viabilidade e rentabilidade", "Relatorio_Viabilidade_Rentabilidade_BLITZ_1.pdf", "Affordability (Sprint 1)"],
    ["Portabilidade (ADR 001)", "Decisao_Portabilidade_ADR_BLITZ.pdf", "Portabilidade da plataforma (Sprint 1)"],
    ["Pesquisa de cores e tokens", "Paleta_de_Cores_e_Tokens_BLITZ.pdf", "Pesquisa de cores (Sprint 2)"],
    ["Manual do usuário", "MANUAL_SISTEMA.docx", "Manual (Sprint 2)"],
    ["Registro das dailies", "S2_Registro-de-Dailies_Gestao-do-Projeto.xlsx", "Registro de dailies (Sprint 2)"],
    ["Plano de testes e casos de teste", "S6_Plano-de-Testes_Casos-de-Teste.pdf", "Plano de testes e casos de teste (Sprint 6)"],
    ["Relatório dos testes funcionais", "S6_Relatorio-Testes-Funcionais.pdf", "Executar testes funcionais do protótipo (Sprint 6)"],
    ["Relatório de acessibilidade", "S6_Relatorio-Acessibilidade-WCAG.pdf", "Testes de acessibilidade (Sprint 6)"],
    ["Relatório de usabilidade", "S6_Relatorio-Usabilidade.pdf", "Teste de usabilidade com usuários reais (Sprint 6)"],
    ["Relatório de correção dos defeitos", "S6_Relatorio-Correcao-Defeitos.pdf", "Correção dos defeitos encontrados na homologação (Sprint 6)"],
])}
<h2>3. Documentos de apoio</h2>
{tabela(["Documento", "Arquivo", "Cartão (lista)"], [
    ["Requisitos de acessibilidade digital", "Documento Acessibilidade Digital.docx", "Documentação de requisitos de acessibilidade digital (Sprint 2)"],
    ["Modelo de dados", "Modelo_de_Dados_BLITZ.pdf; S3_Estrutura-Banco-de-Dados_Modelo-de-Dados.docx", "Criar estrutura do banco de dados de usuários (Sprint 3)"],
    ["Linha de telas e fluxo de navegação", "S3_Linha-de-Telas_Fluxo-de-Navegacao.docx", "Linha de telas e linkagem de funções (Sprint 3)"],
    ["Design system", "S3_Prototipagem-Design_Design-System.pdf", "Prototipagem de design (Sprint 3)"],
    ["Política de privacidade e termos (LGPD)", "S5_Uso-da-LGPD_Politica-Privacidade-e-Termos.docx", "Uso da LGPD no documento de requisitos e no protótipo (Sprint 5)"],
    ["Revisão de infraestrutura da IA", "S5_Revisao-Infra-IA_Relatorio.docx", "Revisão de infraestrutura do assistente de IA (Sprint 5)"],
    ["Plano de saneamento do quadro", "S5_Plano-de-Saneamento_Auditoria-QA.pdf", "Plano de saneamento do quadro (Sprint 5)"],
])}
<h2>4. Pendências</h2>
{lista(["Monografia formatada conforme as normas da instituição: não entregue em 07/10, sem data definida.",
        "Anexar o arquivo do documento de requisitos v2.0 ao cartão \"Documento Requisitos\"."])}
"""

# ---------------------------------------------------------------- cartão 8: revisão dos dashboards
# Confirmado pelo Luiz (19/11): revisadas as consultas e o tempo de resposta (abaixo de 2 s, valor exato não anotado),
# nenhum ajuste aplicado; índices e painel B2B não revisados nesta rodada.
def relatorio_dashboards():
    return f"""
<div class="marca">BLITZ · TCC Equipe T03N</div>
<h1>Revisão dos dashboards e métricas de foco</h1>
<p class="sub">Sprint 6 - Testes, homologação e entrega · Responsável: Vinicius Fagundes · Revisão em 25/09/2026</p>
<h2>1. Resumo</h2>
{tabela(["Item", "Resultado"], [
    ["Consultas revisadas", "As que alimentam a tela de Métricas e o resumo do painel"],
    ["Tempo de resposta", "Abaixo de 2 segundos em todas as consultas revisadas, com massa de teste (RNF01). O valor exato de cada medição não foi anotado."],
    ["Ajustes aplicados", "Nenhum: as consultas atenderam ao critério sem mudanças"],
])}
<h2>2. Consultas revisadas</h2>
{tabela(["Métrica", "O que a consulta calcula", "Resultado"], [
    ["Foco de hoje", "Soma da duração das sessões encerradas no dia", "Correta e abaixo de 2 s"],
    ["Foco da semana", "Soma da duração das sessões dos últimos 7 dias", "Correta e abaixo de 2 s"],
    ["Foco por dia", "Total de foco de cada um dos últimos 7 dias, para o gráfico", "Correta e abaixo de 2 s"],
    ["Sessões", "Total de sessões e sessões da semana, com a duração média", "Correta e abaixo de 2 s"],
    ["Tarefas concluídas", "Quantidade de tarefas com status Concluída", "Correta e abaixo de 2 s"],
])}
<h2>3. Fora desta revisão</h2>
{lista(["Índices do PostgreSQL nas tabelas de sessões de foco e de tarefas: não revisados nesta rodada.",
        "Painel agregado por equipe (visão B2B, view vw_metricas_organizacao): não revisado nesta rodada.",
        "Agregação por mês: não revisada nesta rodada."])}
<h2>4. Critérios de aceitação do cartão</h2>
{tabela(["Critério", "Situação"], [
    ["Consultas de métricas respondendo em tempo aceitável com massa de teste", "Atendido (abaixo de 2 segundos)"],
    ["Nenhum dashboard agregado expondo dados individuais", "Não verificado nesta revisão"],
])}
"""

DOCS = [("S6_Plano-de-Testes_Casos-de-Teste", "Plano de testes", plano_testes),
        ("S6_Revisao-Dashboards-Metricas", "Dashboards", relatorio_dashboards),
        ("S6_Indice-Documentacao-Entrega-Final", "Entrega final", indice_entrega),
        ("S6_Relatorio-Correcao-Defeitos", "Correção de defeitos", relatorio_correcoes),
        ("S6_Relatorio-Usabilidade", "Usabilidade", relatorio_usabilidade),
        ("S6_Relatorio-Testes-Funcionais", "Testes funcionais", relatorio_funcional),
        ("S6_Relatorio-Acessibilidade-WCAG", "Acessibilidade", relatorio_acessibilidade)]


def main():
    PASTA.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        for nome, titulo, corpo in DOCS:
            src = pathlib.Path(tmp) / f"{nome}.html"
            src.write_text(f'<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>{titulo}</title><style>{CSS}</style></head><body>{corpo()}</body></html>', encoding="utf-8")
            pdf = PASTA / f"{nome}.pdf"
            subprocess.run([EDGE, "--headless", "--disable-gpu", "--no-pdf-header-footer", f"--print-to-pdf={pdf}", src.as_uri()], check=True, capture_output=True, timeout=60)
            print(pdf.name, pdf.stat().st_size, "bytes")


if __name__ == "__main__":
    main()
