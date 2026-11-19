# Registros de entrega das Sprints 7 e 8, um PDF por cartão do Trello.
# Fonte: commits do repositório (mensagem, data, arquivos alterados) e testes; o que o código não mostra
# (participantes, revisão, status) foi confirmado com o Luiz por formulário.
# Uso: python docs/sprint78/gerar_sprint78.py
import html, pathlib, subprocess, sys, tempfile

PASTA = pathlib.Path(__file__).parent / "pdf"
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
GH = "https://github.com/luizmarinello/blitz/commit/"
CSS = """
@page { size: A4; margin: 18mm 16mm; }
body { font-family: "Segoe UI", Arial, sans-serif; color: #16181D; font-size: 10.5pt; line-height: 1.45; }
.marca { font-weight: 700; color: #1D4ED8; } h1 { font-size: 17pt; margin: 2px 0; } .sub { color: #5B616E; margin: 0 0 12px; }
h2 { font-size: 12pt; color: #1D4ED8; margin: 14px 0 4px; } ul { margin: 2px 0; padding-left: 18px; } li { margin: 2px 0; }
table { border-collapse: collapse; width: 100%; margin: 6px 0 8px; font-size: 9.5pt; } th, td { border: 1px solid #E2E4E9; padding: 4px 6px; vertical-align: top; text-align: left; }
th { background: #EEF2FB; } td:first-child { width: 28%; color: #5B616E; } a { color: #1D4ED8; } .pend { color: #96590A; font-weight: 600; }
"""

def esc(s):
    return html.escape(s).replace("[", '<span class="pend">[').replace("]", "]</span>")

def lista(itens):
    return "<ul>" + "".join(f"<li>{esc(i)}</li>" for i in itens) + "</ul>"

def registro(d):
    commits = "".join(f'<li><a href="{GH}{h}">{h}</a> · {esc(t)}</li>' for h, t in d["commits"])
    info = [("Sprint", d["sprint"]), ("Responsável", d["resp"]), ("Data de entrega", d["data"]), ("Requisitos", d["req"])]
    if d.get("participantes"):
        info.insert(2, ("Participantes", d["participantes"]))
    tab = "".join(f"<tr><td>{esc(a)}</td><td>{esc(b)}</td></tr>" for a, b in info)
    extra = "".join(f"<h2>{esc(t)}</h2>{lista(i)}" for t, i in d.get("extras", []))
    return f"""<div class="marca">BLITZ · TCC Equipe T03N</div>
<h1>{esc(d['titulo'])}</h1><p class="sub">Registro de entrega</p>
<table>{tab}</table>
<h2>Objetivo</h2><p>{esc(d['objetivo'])}</p>
{"<h2>O que foi feito</h2>" + lista(d["feito"]) if d["feito"] else ""}
{extra}
<h2>Como verificar</h2>{lista(d['verificar'])}
<h2>Evidências no repositório</h2><ul>{commits}</ul>"""

S7 = "Sprint 7 - Stack definitiva e MVP publicado (08/10 a 03/11)"
S8 = "Sprint 8 - Experiência e identidade visual (04/11 a 17/11)"
LUIZ = "Luiz Henrique Marinello da Rosa"

REGISTROS = [
  dict(arquivo="S7_Publicacao-GitHub-Pages", sprint=S7, resp=LUIZ, participantes="Luiz Henrique Marinello da Rosa, Vinicius Fagundes e Raphael Gomes Henke", data="08/10/2026", req="RNF04 (HTTPS), RNF05 (Git + CI)",
       titulo="Publicação estática no GitHub Pages",
       objetivo="Deixar a versão em React + Supabase (branch blitz-v2) acessível pela internet, com HTTPS e publicação automática a cada alteração.",
       feito=["Fluxo de publicação automática (GitHub Actions) que gera o site e publica no GitHub Pages a cada envio de código.",
              "Rotas e links enviados por e-mail (confirmação de conta e recuperação de senha) ajustados para funcionar dentro do endereço do Pages.",
              "Página 404 igual à inicial, para que endereços como /cadastro abram direto.",
              "Só a chave pública do Supabase fica no código publicado; a chave secreta continua fora do repositório.",
              "A publicação foi movida para um repositório próprio (luizmarinello/blitz-estatico), que é o que o GitHub libera para o Pages por padrão."],
       verificar=["Build conferido em um Linux limpo (Docker, npm ci) e rotas testadas no caminho de publicação com o vite preview."],
       commits=[("893180e", "Publicação estática no GitHub Pages"), ("4286939", "Publicação passa para o repositório blitz-estatico")]),
  dict(arquivo="S7_ADR-002_Stack-Definitiva", sprint=S7, resp=LUIZ, participantes="Decisão da equipe: Luiz Henrique Marinello da Rosa, Vinicius Fagundes e Raphael Gomes Henke", data="29/10/2026", req="ADR 001 (web-first), RNF04, RNF05, RNF08",
       titulo="ADR 002 - Stack definitiva: Java/Spring + TypeScript no Render + Neon",
       objetivo="Registrar a decisão de arquitetura que definiu a base do MVP publicado e o motivo da troca.",
       feito=[],
       extras=[("Contexto", ["A ADR 001 definiu a estratégia web-first (aplicação web responsiva como base).",
                             "Em 05/10 a equipe começou uma nova base em React 18 + TypeScript + Tailwind + Supabase (branch blitz-v2), publicada no GitHub Pages em 08/10.",
                             "A branch main já tinha a versão em Java/Spring + TypeScript com quadro, sessões de foco, modos, assistente, LGPD, acessibilidade, administração e testes automatizados."]),
               ("Decisão (29/10/2026)", ["O MVP segue na base da branch main: Java 21 + Spring Boot 3.5 + Flyway no back-end e TypeScript + Vite no front-end.",
                                          "Publicação no Render, com a API em Docker e o site estático em serviços separados, e banco PostgreSQL no Neon."]),
               ("Motivo", ["A main já tinha as funções principais prontas e testadas, o que permitia colocar o MVP no ar na mesma semana; a blitz-v2 só tinha a base e as telas de entrada."]),
               ("Consequências", ["A branch blitz-v2 fica parada, como referência.",
                                  "A chave da IA continua só no servidor: o back-end faz o papel de intermediário que antes seria a Edge Function do Supabase.",
                                  "O protótipo do Lovable deixa de ser a referência do produto; a referência passa a ser https://blitz-front.onrender.com.",
                                  "A seção 2 do CLAUDE.md passa a descrever a stack real."])],
       verificar=["Site publicado em https://blitz-front.onrender.com respondendo com a base da main."],
       commits=[("f4e5880", "Base da blitz-v2 em React + Supabase (05/10)"), ("67954ca", "Deploy da main no Render + Neon (29/10)")]),
  dict(arquivo="S7_Deploy-Render-Neon", sprint=S7, resp=LUIZ, participantes="Luiz Henrique Marinello da Rosa e Raphael Gomes Henke", data="29/10/2026", req="RNF04, RNF05, RNF08, RN01",
       titulo="Deploy do MVP no Render + Neon",
       objetivo="Colocar o MVP no ar com HTTPS, banco de dados gerenciado e integração contínua.",
       feito=["Site (front-end) publicado como Static Site no Render, apontando para o endereço da API.",
              "API (back-end) publicada como serviço Docker no Render, com acesso restrito ao endereço do site (CORS) e cookie de sessão seguro entre os dois endereços.",
              "Endereço público de verificação de saúde (/api/auth/saude) usado pelo Render para saber se a API está no ar.",
              "Banco PostgreSQL no Neon.",
              "Integração contínua no GitHub Actions: testes do back-end e build do front-end a cada envio de código.",
              "Correção do Maven Wrapper, que não rodava em um clone novo do repositório.",
              "README e ESTRUTURA.md com as variáveis e as decisões do deploy."],
       verificar=["Teste automatizado do back-end confere que a API só aceita chamadas do endereço do site.",
                  "Site: https://blitz-front.onrender.com · API: https://blitz-api-l26x.onrender.com/api/auth/saude"],
       commits=[("67954ca", "Deploy em dois serviços no Render + Neon"), ("31daba9", "CI: Maven Wrapper com permissão de execução")]),
  dict(arquivo="S7_Teste-Ponta-a-Ponta-MVP", sprint=S7, resp=LUIZ, data="30/10/2026", req="RF-LGPD03, RF17, RF04, RNF02, RA03",
       titulo="Teste de ponta a ponta do MVP publicado e correções",
       objetivo="Conferir o fluxo completo no site publicado e corrigir o que só aparece com o site e a API em endereços diferentes.",
       feito=["Roteiro automatizado de 26 passos (scripts/smoke.sh) executado contra a API publicada: cadastro com e sem aceite, consentimento gravado, listas e tarefas, conclusão e reabertura, modos, sessão de foco, bloqueio de exclusão de modo usado, exclusão de tarefa mantendo a sessão, métricas, assistente e limite, acessibilidade, exportação JSON e CSV e exclusão de conta com anonimização.",
              "Correção: a exportação de dados abria o endereço do site em vez da API; passou a baixar o arquivo pela API com a sessão da pessoa (RF-LGPD03).",
              "Correção: resposta automática do assistente com acentos e datas no formato dd/mm/aaaa; aviso de que a IA não respondeu só quando há chave configurada (RF17).",
              "Correção: mensagens de \"não encontrado\" sem \"(a)\" (RF04).",
              "Correção: no celular a navegação escondia Modos, Assistente e Métricas; passou a ter linha própria (RNF02).",
              "Correção: atributos de acessibilidade (aria-current) eram exibidos como texto (RA03)."],
       verificar=["Roteiro executado de novo depois das correções: \"TODOS OS PASSOS PASSARAM\"."],
       commits=[("11d5e85", "Correções do teste de ponta a ponta no MVP publicado")]),
  dict(arquivo="S7_Refinamento-Visual-Tema", sprint=S7, resp=LUIZ, data="30/10/2026", req="RA01, RA02, RA04 a RA06, RN08, UC12",
       titulo="Refinamento visual e alternância de tema",
       objetivo="Melhorar a aparência do MVP publicado sem perder os requisitos de acessibilidade.",
       feito=["Tipografia com hierarquia mais clara e números de largura fixa no relógio, nos indicadores e nas tabelas.",
              "Superfícies, sombras e navegação revistas; abas em formato de segmento e etiquetas com fundo suave.",
              "Botão de sol e lua na barra, também antes do login, para alternar entre tema claro e escuro; com login, a escolha fica gravada nas preferências e o cadastro leva o tema escolhido para a conta nova.",
              "Antes de qualquer escolha, o app segue o tema do sistema operacional.",
              "Pequenas animações de entrada; todas desligam com \"reduzir animações\" ou com a preferência do sistema (RA06).",
              "Nenhuma cor escrita fora dos tokens de design (seção 6 do CLAUDE.md)."],
       verificar=["Trocar o tema pelo botão de sol e lua e recarregar a página: a escolha se mantém.",
                  "Ativar \"reduzir animações\" em Acessibilidade: as animações deixam de acontecer."],
       commits=[("858a48f", "Refinamento visual (29/10)"), ("3c19887", "Plano de fundo, micro-animações e alternância de tema (30/10)")]),
  dict(arquivo="S7_Banco-Neon-Ohio", sprint=S7, resp=LUIZ, participantes="Luiz Henrique Marinello da Rosa e Raphael Gomes Henke", data="30/10/2026", req="RNF06, RNF08",
       titulo="Banco Neon em Ohio e exclusão dos projetos sem uso",
       objetivo="Deixar um único banco de produção e remover os projetos de banco que ficaram sem uso.",
       feito=["Banco de produção mantido no projeto Neon \"BLITZ\", na região de Ohio (Estados Unidos).",
              "Projetos Neon de São Paulo, vazios e sem uso, apagados em 29 e 30/10.",
              "ESTRUTURA.md atualizado com o banco em uso e a exclusão dos demais."],
       verificar=["Verificação de saúde da API respondendo normalmente com o banco de Ohio."],
       commits=[("ca53eab", "ESTRUTURA.md reflete o Neon em uso e a exclusão dos projetos de São Paulo")]),
  # ------------------------------------------------------------------ Sprint 8
  dict(arquivo="S8_Barra-Lateral-Painel-Largura", sprint=S8, resp=LUIZ, data="04/11/2026", req="RNF02, RA02, RA03",
       titulo="Barra lateral e painel ocupando a largura da tela",
       objetivo="Aproveitar a largura da tela no computador e organizar a navegação, que antes deixava sobra nas laterais.",
       feito=["Barra lateral fixa com ícones e nomes; entre 768 e 1023 px mostra só os ícones, mantendo o nome para leitores de tela; no celular vira barra inferior.",
              "Menu da conta com avatar e botão de tema no rodapé da barra.",
              "Painel com os resumos em faixa acima do quadro e o quadro usando a largura toda.",
              "Assistente em coluna fixa a partir de 1440 px ou em gaveta lateral abaixo disso (Esc fecha e o foco volta ao botão que abriu).",
              "No celular o quadro aparece antes dos resumos.",
              "Correção no mesmo dia: telas sem login voltaram a ficar centralizadas."],
       verificar=["Abrir o painel em tela larga, média e no celular e conferir a barra, o quadro e o assistente.",
                  "Navegar só pelo teclado: abrir e fechar a gaveta do assistente com Enter e Esc."],
       commits=[("7d83fdd", "Barra lateral e painel ocupando a largura da tela"), ("b890ae9", "Telas sem login voltam a ficar centralizadas")]),
  dict(arquivo="S8_Sessao-Foco-Imersiva", sprint=S8, resp=LUIZ, data="04/11/2026", req="UC03, RN05, RA07",
       titulo="Sessão de foco em modo imersivo",
       objetivo="Deixar na tela só o que importa durante a sessão de foco.",
       feito=["Com uma sessão ativa a barra lateral some, o relógio cresce e a tarefa em andamento fica em destaque.",
              "Botão discreto \"Painel\" no canto para voltar; qualquer troca de tela sai do modo imersivo.",
              "Pausa indicada também em texto (\"Foco · pausado\") e com o relógio esmaecido, não só por cor (RA07)."],
       verificar=["Iniciar uma sessão de foco, pausar e retomar, e voltar ao painel pelo botão do canto."],
       commits=[("00e1e48", "Sessão de foco em modo imersivo")]),
  dict(arquivo="S8_Hierarquia-Quadro-Comece-Por-Aqui", sprint=S8, resp=LUIZ, data="04/11/2026", req="RA07, RF16",
       titulo="Hierarquia visual do quadro e cartão \"Comece por aqui\"",
       objetivo="Deixar o estado e a prioridade de cada tarefa claros à primeira vista e indicar por onde começar.",
       feito=["Colunas com símbolo por status (○ a fazer, ◐ em andamento, ✓ concluída), nunca só cor.",
              "Prioridade mostrada com texto e símbolo; tarefas concluídas esmaecidas.",
              "Destaque \"Comece por aqui\" na tarefa que o critério do assistente (prazo, prioridade e esforço) coloca em primeiro lugar."],
       verificar=["Criar tarefas com prazos e prioridades diferentes e conferir qual recebe o destaque."],
       commits=[("5ea69ee", "Hierarquia visual do quadro")]),
  dict(arquivo="S8_Primeiro-Uso-Guiado", sprint=S8, resp=LUIZ, data="04/11/2026", req="Seção 8 (estado vazio), UC02, UC03, UC04",
       titulo="Primeiro uso que ensina o fluxo",
       objetivo="Orientar quem entra pela primeira vez, ponto de atrito observado no teste de usabilidade da Sprint 6.",
       feito=["Conta sem nenhuma tarefa vê um guia de três passos no lugar do quadro vazio: criar tarefa, perguntar ao assistente e iniciar uma sessão de foco.",
              "Botão \"Criar 3 tarefas de exemplo\", com títulos que ensinam a ação (arrastar, perguntar, focar) e prioridades e prazos diferentes.",
              "Listas vazias de quem já tem tarefas mantêm o estado vazio simples."],
       verificar=["Criar uma conta nova e conferir o guia; usar o botão de exemplos e ver as três tarefas no quadro."],
       commits=[("41fe6f0", "Primeiro uso que ensina o fluxo")]),
  dict(arquivo="S8_Entrada-Rapida-Atalhos", sprint=S8, resp=LUIZ, data="04/11/2026", req="RF06, RNF01",
       titulo="Entrada rápida de tarefas com atalhos",
       objetivo="Cadastrar uma tarefa em segundos, sem abrir formulário.",
       feito=["Campo sempre visível acima do quadro: Enter cria a tarefa na lista atual.",
              "Atalhos: \"!alta\", \"!media\" e \"!baixa\" para prioridade; \"@hoje\", \"@amanhã\", \"@sexta\" ou \"@25/11\" para prazo; \"2h\" ou \"1,5h\" para horas estimadas.",
              "Aviso confirma o que foi entendido; um \"@\" que não é data continua no título."],
       verificar=["Digitar \"Revisar slides !alta @sexta 2h\" e conferir prioridade, prazo e horas da tarefa criada.",
                  "Checagem automática do interpretador: node scripts/rapida.check.ts (15 verificações)."],
       commits=[("35e0ae2", "Entrada rápida de tarefa com atalhos")]),
  dict(arquivo="S8_Assistente-Que-Age", sprint=S8, resp=LUIZ, data="04/11/2026", req="RF16, UC04",
       titulo="Assistente que age: focar na primeira e aplicar a ordem no quadro",
       objetivo="Transformar a sugestão do assistente em ação, sem a pessoa ter de reorganizar o quadro à mão.",
       feito=["A resposta do assistente traz as tarefas sugeridas, na ordem.",
              "Botão \"Focar na primeira agora\" abre a sessão de foco já com a tarefa escolhida.",
              "Botão \"Aplicar ordem no quadro\" reordena as tarefas e redesenha o painel.",
              "Com a IA conectada, o modelo devolve a ordem numa linha própria, que o sistema lê e esconde antes de mostrar a resposta."],
       verificar=["Perguntar ao assistente \"O que devo fazer agora?\" e usar os dois botões.",
                  "Teste de integração do back-end cobre as tarefas sugeridas e a reordenação."],
       commits=[("47fa4eb", "Assistente que age: focar na primeira e aplicar a ordem no quadro")]),
  dict(arquivo="S8_Modos-Identidade-Comportamento", sprint=S8, resp=LUIZ, data="05/11/2026", req="RN05, UC05, RA07",
       titulo="Modos de concentração com identidade e comportamento próprio",
       objetivo="Deixar claro o que cada modo muda na sessão, ponto de atrito observado no teste de usabilidade da Sprint 6.",
       feito=["Cada modo ganhou ícone próprio na tela de modos e na sessão.",
              "Pomodoro marca os ciclos em quatro bolinhas, e o texto continua dizendo o número.",
              "Profundo esconde \"pular fase\", a contagem de ciclos e as dicas, e não interrompe com avisos (erros continuam aparecendo).",
              "Relax dá destaque à pausa, com uma mensagem de respiração.",
              "Na pausa a barra de progresso fica verde. (As cores dos modos foram unificadas no azul da marca em 13/11, mantendo os ícones.)"],
       verificar=["Iniciar uma sessão em cada modo e conferir o comportamento descrito."],
       commits=[("6ecce94", "Modos de concentração com identidade e comportamento próprio")]),
  dict(arquivo="S8_Logo-Identidade-Dois-Temas", sprint=S8, resp=LUIZ, data="13/11/2026", req="RA01, RA05, RA08",
       titulo="Logo oficial e identidade visual em dois temas",
       objetivo="Aplicar a identidade da marca no produto, com contraste verificado nos temas.",
       feito=["Logo oficial do Blitz (raio amarelo no lugar do Z) aplicada a partir das artes oficiais: versão de texto branco, de texto preto e só o ícone na barra recolhida e no favicon.",
              "Imagens da logo com texto alternativo adequado: dentro de um link chamado \"Blitz\" (RA08).",
              "Identidade em dois temas, azul com escuro e azul com branco, com os contrastes recalculados e registrados na seção 6 do CLAUDE.md (RA01).",
              "Verde, âmbar e vermelho passam a aparecer só onde significam estado ou prioridade (RA07).",
              "Alto contraste mantido como recurso de acessibilidade (RA05)."],
       verificar=["Alternar entre os temas e conferir a logo e as cores; recolher a barra e ver só o ícone."],
       commits=[("7ea72e6", "Identidade visual e logo com raio amarelo (04/11)"), ("b97058b", "Logo oficial do Blitz (04/11)"), ("cdc93e7", "Identidade em dois temas (13/11)")]),
  dict(arquivo="S8_Foco-Por-Tarefa-Resumo-Avisos", sprint=S8, resp=LUIZ, data="13/11/2026", req="RN03, RF14, RN01, RF04, RNF08",
       titulo="Foco por tarefa, resumo da semana e avisos de sessão e servidor",
       objetivo="Mostrar quanto foco cada tarefa recebeu e tornar claros dois problemas do plano gratuito: sessão perdida e servidor acordando.",
       feito=["Tempo de foco acumulado aparece no cartão da tarefa e no detalhe, com total, número de sessões e última sessão (RN03).",
              "Tela de métricas com \"Sua semana\": frase-resumo, sequência de dias, melhor dia, período em que mais foca e tarefa com mais foco, tudo calculado dos dados (RF14).",
              "Sessão perdida no servidor leva ao login com aviso, em vez de travar a tela (RN01).",
              "Requisição que demora mais de 4 segundos mostra o aviso de que o servidor está acordando (RNF08).",
              "Pedido com conteúdo ilegível responde com mensagem em português (RF04)."],
       verificar=["Fazer uma sessão de foco numa tarefa e conferir o tempo no cartão e no detalhe.",
                  "Teste de integração do back-end cobre o foco por tarefa e a mensagem de conteúdo ilegível."],
       commits=[("fee4b62", "Foco por tarefa, resumo da semana, sessão expirada e servidor acordando")]),
  dict(arquivo="S8_Visual-Claro-Painel-Compacto", sprint=S8, resp=LUIZ, data="17/11/2026", req="RNF02, RA01, RA02, RA05, RA06, RA07, UC04",
       titulo="Visual claro, painel compacto e assistente retrátil",
       objetivo="Deixar o painel mais organizado e prático e o visual mais profissional e menos chamativo.",
       feito=["Faixa de resumo em uma linha (Foco, Sprint e Hoje) no lugar de três cartões altos; quadro mais denso, com botões dos cartões de 30 px, acima do mínimo de 24 px.",
              "Assistente retrátil nas telas largas: um botão recolhe a coluna, o quadro ocupa a largura toda e a escolha fica guardada no navegador.",
              "Tema claro (branco + azul) como padrão e tema escuro em grafite; contrastes recalculados na seção 6 do CLAUDE.md.",
              "Fonte do sistema no lugar das fontes baixadas do Google: carrega mais rápido e não faz chamada externa.",
              "Sem faixas coloridas, gradientes nem brilho; cor de estado só em etiquetas com texto e símbolo (RA07).",
              "O halo do relógio pulsava num ritmo lento e contínuo, que as diretrizes de movimento pedem para evitar; ficou parado (RA06).",
              "Correção: na sessão de foco o conteúdo aparecia deslocado para a direita."],
       verificar=["Recolher o assistente, recarregar a página e conferir que continua recolhido.",
                  "Conferir o tema claro e o escuro no painel, na sessão de foco, nas métricas e no celular."],
       commits=[("fddd538", "Painel compacto, visual mais sóbrio e assistente retrátil"), ("0b0f895", "Visual claro e profissional")]),
  dict(arquivo="S8_Correcao-Erro-Sobre-Login", sprint=S8, resp=LUIZ, data="17/11/2026", req="RN01, RF04",
       titulo="Correção: erro por cima do login depois que a sessão expira",
       objetivo="Corrigir a tela de erro que aparecia por cima do login quando a API reiniciava.",
       feito=["Problema: quando a API reiniciava (deploy novo ou plano gratuito acordando), a primeira resposta levava ao login, mas uma consulta da tela anterior terminava depois e desenhava \"Não foi possível carregar / Faça login para continuar\" por cima, com um \"Tentar de novo\" que não funcionava.",
              "Correção: cada tela é montada num espaço próprio; resposta atrasada de uma tela antiga não aparece mais."],
       verificar=["Reproduzido localmente atrasando de propósito as consultas do painel e derrubando a sessão: com o código antigo o erro aparecia; com a correção, a pessoa cai no login com o aviso de sessão expirada."],
       commits=[("98ef154", "Sessão expirada não deixa mais a tela de erro por cima do login")]),
]


def main():
    PASTA.mkdir(parents=True, exist_ok=True)
    so = sys.argv[1:]
    with tempfile.TemporaryDirectory() as tmp:
        for d in REGISTROS:
            if so and not any(d["arquivo"].startswith(p) for p in so):
                continue
            src = pathlib.Path(tmp) / (d["arquivo"] + ".html")
            src.write_text(f'<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>{d["titulo"]}</title><style>{CSS}</style></head><body>{registro(d)}</body></html>', encoding="utf-8")
            pdf = PASTA / (d["arquivo"] + ".pdf")
            subprocess.run([EDGE, "--headless", "--disable-gpu", "--no-pdf-header-footer", f"--print-to-pdf={pdf}", src.as_uri()], check=True, capture_output=True, timeout=60)
            print(pdf.name, pdf.stat().st_size, "bytes")


if __name__ == "__main__":
    main()
