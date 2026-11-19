# Atas das dailies semanais (terças-feiras) do projeto Blitz, por sprint.
# Fonte de cada item: cartões, comentários e datas do quadro Trello "TCC APP T03N" e o histórico do repositório.
# Participantes e conteúdo revisados pelo Luiz em 19/11/2026.
#
# Uso:  python docs/dailies/gerar_dailies.py            -> PDFs de RASCUNHO (com faixa de revisão)
#       python docs/dailies/gerar_dailies.py --final    -> PDFs finais, depois de revisados
import html, pathlib, subprocess, sys, tempfile

FINAL = "--final" in sys.argv
PASTA = pathlib.Path(__file__).parent / ("final" if FINAL else "rascunho")
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
EQUIPE = "Luiz Henrique Marinello da Rosa, Vinicius Fagundes e Raphael Gomes Henke"

DAILIES = [
    # ------------------------------------------------------------------ Sprint 4
    dict(sprint="Sprint 4 - Remodelagem (19/05 a 02/06)", data="19/05/2026", arquivo="S4_Daily_2026-05-19",
         pauta="Abertura da sprint",
         feito=["Documentação de Casos de Uso concluída em 12/05 (Luiz).",
                "Manual do usuário e pesquisa de cores entregues no prazo de 19/05 (Raphael).",
                "Primeira versão do diagrama de atividades iniciada em 12/05 (Luiz)."],
         proximo=["Luiz: concluir a configuração do ambiente de desenvolvimento (Electron, React, Node.js, PostgreSQL e Supabase) até 22/05 e seguir com o diagrama de atividades (prazo 26/05).",
                  "Vinicius: iniciar o sistema de login e registro com e-mail e senha (prazo 02/06).",
                  "Raphael: retomar a interface de Modos de Foco (prazo 26/05)."],
         impedimentos=["Nenhum impedimento registrado no quadro."],
         decisoes=["Abertura da Sprint 4 - Remodelagem: os quatro cartões da sprint passam para andamento hoje."]),
    dict(sprint="Sprint 4 - Remodelagem (19/05 a 02/06)", data="26/05/2026", arquivo="S4_Daily_2026-05-26",
         pauta="Acompanhamento",
         feito=["Ambiente de desenvolvimento configurado (prazo 22/05) (Luiz).",
                "Login e registro em desenvolvimento (Vinicius).",
                "Modos de Foco: os modos foram criados na interface, mas ainda não estão disponíveis para uso (Raphael).",
                "Diagrama de atividades em ajuste conforme as alterações pedidas pela professora (Luiz)."],
         proximo=["Luiz: fechar o diagrama de atividades (prazo hoje).",
                  "Vinicius: concluir login e registro (02/06), deixar uma conta de teste criada para a equipe e iniciar o diagrama de classes (26/05 a 02/06).",
                  "Raphael: tornar os modos de foco utilizáveis de ponta a ponta antes de concluir o cartão."],
         impedimentos=["Modos de Foco ainda não funcionam de ponta a ponta: o cartão não deve ser concluído enquanto isso não for resolvido."],
         decisoes=["No login, priorizar o funcionamento e não o visual: o front será remodelado na sprint seguinte."]),
    dict(sprint="Sprint 4 - Remodelagem (19/05 a 02/06)", data="02/06/2026", arquivo="S4_Daily_2026-06-02",
         pauta="Encerramento da sprint",
         feito=["Diagrama de atividades concluído (26/05) (Luiz).",
                "Login e registro com e-mail e senha concluídos (Vinicius).",
                "Diagrama de classes em finalização, prazo hoje (Vinicius)."],
         proximo=["Revisão da sprint e organização dos entregáveis para avaliação.",
                  "Recesso a partir de 03/06; as atividades voltam em 01/09, com a devolutiva da avaliação."],
         impedimentos=["Interface de Modos de Foco segue incompleta: os modos existem, mas não estão disponíveis para uso. Fica registrada como pendência (Raphael)."],
         decisoes=["A sprint, planejada inicialmente até 23/05, foi estendida até 02/06 (ajuste feito no quadro em 29/05)."]),
    # ------------------------------------------------------------------ Sprint 5
    dict(sprint="Sprint 5 - Correções da devolutiva (01/09 a 22/09)", data="01/09/2026", arquivo="S5_Daily_2026-09-01",
         pauta="Abertura da sprint",
         feito=["Retorno das atividades após o recesso iniciado em 03/06.",
                "E-mail de resposta à devolutiva enviado, com o plano de correções organizado em nova sprint no quadro (Luiz)."],
         proximo=["Luiz: incluir a LGPD no documento de requisitos e no protótipo (prazo 15/09); atualizar os diagramas de casos de uso e de atividades (08/09) e a documentação de casos de uso (15/09); preparar a apresentação ao cliente (22/09).",
                  "Vinicius: incluir os itens de acessibilidade no diagrama de classes (prazo 08/09).",
                  "Raphael: retomar a pendência de Modos de Foco da Sprint 4 (modos criados, mas ainda não utilizáveis) e levantar o que falta para concluí-la."],
         impedimentos=["Nenhum impedimento registrado no quadro."],
         decisoes=["A Sprint 5 trata os pontos da devolutiva: LGPD, acessibilidade, atualização dos diagramas e da documentação de casos de uso e apresentação ao cliente."]),
    dict(sprint="Sprint 5 - Correções da devolutiva (01/09 a 22/09)", data="08/09/2026", arquivo="S5_Daily_2026-09-08",
         pauta="Acompanhamento e resultado da auditoria do quadro",
         feito=["Propostas de UC11 (consentimento e dados pessoais) e UC12 (acessibilidade) e da classe Consentimento registradas no quadro em 04/09 (Luiz).",
                "Diagramas de casos de uso e de atividades atualizados, aguardando revisão (Luiz).",
                "Auditoria do quadro realizada hoje. Principais achados: cartão de Modos de Foco marcado como concluído e incompleto ao mesmo tempo; \"Mostrar para o cliente\" marcado como concluído antes da apresentação; documentação de casos de uso ainda descrita como rascunho; cartões com prazo anterior à sprint em que estão."],
         proximo=["Todos: executar o Passo 1 do plano de saneamento (09 e 10/09) e o Passo 2 (até 12/09).",
                  "Luiz: revisão de infraestrutura do assistente de IA (prazo 18/09).",
                  "Raphael: concluir a interface de Modos de Foco, pendência da Sprint 4 (prazo 19/09).",
                  "Vinicius: concluir os itens de acessibilidade no diagrama de classes."],
         impedimentos=["Itens de acessibilidade no diagrama de classes venceram hoje sem entrega (Vinicius)."],
         decisoes=["Criado o Plano de saneamento do quadro, com prazo até 22/09.",
                   "A pendência de Modos de Foco passa para a Sprint 5 em cartão novo, em vez de ficar marcada como concluída na Sprint 4.",
                   "A revisão de infraestrutura do assistente de IA entra na Sprint 5."]),
    dict(sprint="Sprint 5 - Correções da devolutiva (01/09 a 22/09)", data="15/09/2026", arquivo="S5_Daily_2026-09-15",
         pauta="Acompanhamento",
         feito=["Passos 1 e 2 do plano de saneamento concluídos: conclusões indevidas desmarcadas, etiquetas sem uso removidas, responsáveis ajustados e documentos anexados aos cartões.",
                "Relatórios das sprints anteriores anexados em PDF (10 e 11/09) (Luiz).",
                "Reunião de 30 minutos para definir as datas reais de início e fim das Sprints 1, 2 e 3 (Passo 2 do plano).",
                "LGPD no documento de requisitos e no protótipo: entregue para revisão (prazo hoje) (Luiz).",
                "Documentação de casos de uso atualizada (prazo hoje) (Luiz)."],
         proximo=["Luiz: entregar a revisão de infraestrutura do assistente de IA (18/09) e preparar a apresentação ao cliente (22/09).",
                  "Raphael: concluir a interface de Modos de Foco (19/09).",
                  "Vinicius: concluir os itens de acessibilidade no diagrama de classes."],
         impedimentos=["Itens de acessibilidade no diagrama de classes seguem em atraso (Vinicius)."],
         decisoes=[]),
    dict(sprint="Sprint 5 - Correções da devolutiva (01/09 a 22/09)", data="22/09/2026", arquivo="S5_Daily_2026-09-22",
         pauta="Encerramento da sprint",
         feito=["Revisão de infraestrutura do assistente de IA entregue, com relatório anexado em 18/09 (Luiz).",
                "Interface de Modos de Foco concluída em 19/09, fechando a pendência da Sprint 4 (Raphael).",
                "Itens de acessibilidade no diagrama de classes entregues (versão 2 anexada em 18/09).",
                "Repositório do produto iniciado em 18/09: base em Java/Spring + TypeScript, recuperação de senha (RF03), arrastar e soltar no quadro com equivalente por teclado (US-02), painel administrativo mínimo, organização automática em sprint (RF09) e retenção das conversas com a IA (achado IA-02)."],
         proximo=["Todos: review de fechamento da Sprint 5 e planning da Sprint 6 em 23/09.",
                  "Luiz: puxar do backlog o que couber na Sprint 6."],
         impedimentos=["Apresentação ao cliente não realizada (checklist 0 de 5): fica registrada como pendência.",
                       "Três entregáveis com a etiqueta \"Concluído - Não testado\" ainda aguardam revisão."],
         decisoes=["O que não fechou na Sprint 5 vira cartão novo na Sprint 6, sem ficar marcado como concluído."]),
    # ------------------------------------------------------------------ Sprint 6
    dict(sprint="Sprint 6 - Testes, homologação e entrega (23/09 a 07/10)", data="29/09/2026", arquivo="S6_Daily_2026-09-29",
         pauta="Acompanhamento",
         feito=["Sprint 6 aberta em 23/09 com os cartões de plano de testes, testes funcionais, acessibilidade, usabilidade, correção de defeitos, revisão de dashboards e entrega final da documentação.",
                "Plano de testes e casos de teste entregue em 25/09, com os casos derivados de UC01 a UC12 (Luiz).",
                "Revisão dos dashboards e métricas de foco entregue em 25/09 (Vinicius)."],
         proximo=["Vinicius: executar os testes funcionais (prazo hoje) e abrir um cartão por defeito na lista \"Impedimentos e Defeitos\".",
                  "Raphael: testes de acessibilidade WCAG 2.1 AA (30/09) e teste de usabilidade com usuários (01/10).",
                  "Luiz: consolidar a documentação para a entrega de 07/10."],
         impedimentos=["Nenhum impedimento."],
         decisoes=["Cada defeito encontrado nos testes vira um cartão na lista \"Impedimentos e Defeitos\", seguindo o modelo do quadro."]),
    dict(sprint="Sprint 6 - Testes, homologação e entrega (23/09 a 07/10)", data="06/10/2026", arquivo="S6_Daily_2026-10-06",
         pauta="Acompanhamento e preparação da entrega",
         feito=["Testes funcionais executados (29/09) (Vinicius).",
                "Testes de acessibilidade WCAG 2.1 AA (30/09) e teste de usabilidade com usuários (01/10) realizados (Raphael).",
                "Correção dos defeitos encontrados na homologação concluída em 03/10 (Vinicius).",
                "Em 05/10 o front do Blitz foi recomeçado em React 18 + TypeScript + Tailwind + Framer Motion, com Supabase (ADR 001). Já estão no repositório: base do projeto, banco com regras de acesso por linha (RLS), cadastro com o consentimento gravado no banco (RF-LGPD01, RNF-LGPD06) e as telas de login, cadastro com aceite, recuperação de senha e termos (UC01).",
                "Entrega final: documento de requisitos v2.0 e documentação de casos de uso v2.0 prontos (2 de 7 itens da checklist)."],
         proximo=["Luiz: entrega da documentação (07/10).",
                  "Todos: fechar os entregáveis restantes da checklist final (diagramas, Canvas e pesquisas, manual e dailies, relatórios de testes, monografia)."],
         impedimentos=["Cinco dos sete entregáveis finais ainda em aberto a um dia do prazo de entrega."],
         decisoes=["Prazo de entrega da documentação mantido em 07/10."]),
    # ------------------------------------------------------------------ Sprint 7 (confirmado pelo Luiz em 19/11)
    dict(sprint="Sprint 7 - Stack definitiva e MVP publicado (08/10 a 03/11)", data="13/10/2026", arquivo="S7_Daily_2026-10-13",
         pauta="Abertura da sprint e balanço da entrega de 07/10",
         feito=["Documentação entregue em 07/10, com 6 dos 7 itens da checklist; a monografia ficou pendente.",
                "Versão em React + Supabase publicada como site estático no GitHub Pages em 08/10."],
         proximo=["Luiz e Raphael: estudar o Neon como banco PostgreSQL de produção."],
         impedimentos=["Monografia pendente, ainda sem data de entrega definida."],
         decisoes=["Abertura da Sprint 7, com foco em definir a base do MVP e colocá-lo no ar."]),
    dict(sprint="Sprint 7 - Stack definitiva e MVP publicado (08/10 a 03/11)", data="20/10/2026", arquivo="S7_Daily_2026-10-20",
         pauta="Acompanhamento em semana de provas",
         feito=["Levantamento das opções de publicação: Render para a API e para o site, Neon para o banco de dados."],
         proximo=["Planejar o deploy: serviços no Render, banco no Neon e as variáveis de cada ambiente."],
         impedimentos=["Semana de provas: pouco tempo disponível para o projeto."],
         decisoes=[]),
    dict(sprint="Sprint 7 - Stack definitiva e MVP publicado (08/10 a 03/11)", data="27/10/2026", arquivo="S7_Daily_2026-10-27",
         pauta="Preparação do deploy",
         feito=["Planejamento do deploy concluído: API em Docker e site estático no Render, banco PostgreSQL no Neon."],
         proximo=["Luiz: fazer o deploy da API e do site e configurar a integração contínua no GitHub Actions.",
                  "Raphael: disponibilizar o projeto Neon de produção."],
         impedimentos=["Nenhum impedimento."],
         decisoes=[]),
    dict(sprint="Sprint 7 - Stack definitiva e MVP publicado (08/10 a 03/11)", data="03/11/2026", arquivo="S7_Daily_2026-11-03",
         pauta="Encerramento da sprint",
         feito=["Decisão da equipe registrada na ADR 002 (29/10): o MVP segue na base da main, em Java/Spring + TypeScript.",
                "MVP publicado no Render com banco Neon e integração contínua (29/10) (Luiz e Raphael).",
                "Teste de ponta a ponta no site publicado, com roteiro de 26 passos, e correções dos problemas encontrados (30/10) (Luiz).",
                "Refinamento visual e botão para alternar entre tema claro e escuro (29 e 30/10) (Luiz).",
                "Banco de produção mantido em Ohio e projetos Neon sem uso apagados (30/10) (Luiz e Raphael)."],
         proximo=["Sprint 8 (04/11 a 17/11): experiência e identidade visual do produto publicado.",
                  "Puxar do backlog as melhorias do teste de usabilidade da Sprint 6: primeiro uso guiado e identidade dos modos de concentração."],
         impedimentos=["A API no plano gratuito do Render dorme e leva cerca de 1 minuto para acordar no primeiro acesso."],
         decisoes=["O site publicado (https://blitz-front.onrender.com) passa a ser a referência do produto, no lugar do protótipo do Lovable."]),
    # ------------------------------------------------------------------ Sprint 8 (conteúdo dos commits, confirmado pelo Luiz em 19/11)
    dict(sprint="Sprint 8 - Experiência e identidade visual (04/11 a 17/11)", data="10/11/2026", arquivo="S8_Daily_2026-11-10",
         pauta="Acompanhamento",
         feito=["Barra lateral e painel ocupando a largura da tela, com barra inferior no celular (04/11) (Luiz).",
                "Sessão de foco em modo imersivo (04/11) (Luiz).",
                "Quadro com símbolos de status e o destaque \"Comece por aqui\" (04/11) (Luiz).",
                "Primeiro uso guiado e entrada rápida de tarefas com atalhos (04/11) (Luiz).",
                "Assistente que inicia o foco na primeira tarefa e aplica a ordem sugerida no quadro (04/11) (Luiz).",
                "Logo oficial aplicada no produto (04/11) e modos de concentração com identidade e comportamento próprio (05/11) (Luiz).",
                "Duas melhorias do teste de usabilidade da Sprint 6 atendidas: primeiro uso guiado e identidade dos modos."],
         proximo=["Luiz: mostrar o tempo de foco de cada tarefa e um resumo da semana nas métricas.",
                  "Luiz: levar a pessoa ao login com aviso quando a sessão cair e avisar quando o servidor gratuito estiver acordando.",
                  "Luiz: fechar a identidade visual em dois temas, com os contrastes recalculados."],
         impedimentos=["A sessão de login cai quando a API do plano gratuito reinicia, e a tela fica presa em erro."],
         decisoes=[]),
    dict(sprint="Sprint 8 - Experiência e identidade visual (04/11 a 17/11)", data="17/11/2026", arquivo="S8_Daily_2026-11-17",
         pauta="Encerramento da sprint",
         feito=["Tempo de foco por tarefa, resumo da semana nas métricas, aviso de sessão expirada e aviso de servidor acordando (13/11) (Luiz).",
                "Identidade visual em dois temas com contrastes recalculados (13/11) (Luiz).",
                "Painel compacto, assistente retrátil e visual claro e mais sóbrio (17/11) (Luiz).",
                "Correção da tela de erro que aparecia por cima do login depois que a sessão expirava (17/11) (Luiz)."],
         proximo=["Sprint 9 (18/11 a 01/12): fazer o assistente responder sem uma IA generativa conectada, a partir dos dados de cada pessoa.",
                  "Tratar as pendências da Sprint 6: monografia, testes de acessibilidade que faltaram, questionário SUS e verificação do painel B2B."],
         impedimentos=["Chave da IA (Gemini) ainda não configurada no servidor.",
                       "Servidor de e-mail não configurado em produção: a recuperação de senha não envia o e-mail."],
         decisoes=["Tema claro (branco + azul) passa a ser o padrão; o escuro continua disponível, em grafite."]),
]


def secao(titulo, itens):
    if not itens:
        return ""
    lis = "".join(f"<li>{html.escape(i)}</li>" for i in itens)
    return f"<h2>{titulo}</h2><ul>{lis}</ul>"


def pagina(d):
    faixa = "" if FINAL else '<div class="faixa">RASCUNHO PARA REVISÃO DA EQUIPE. Confirme ou corrija os itens entre colchetes antes da entrega.</div>'
    return f"""<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Daily {d['data']}</title><style>
    @page {{ size: A4; margin: 20mm 18mm; }}
    body {{ font-family: "Segoe UI", Arial, sans-serif; color: #16181D; font-size: 11pt; line-height: 1.5; }}
    .faixa {{ border: 1.5px solid #96590A; color: #96590A; padding: 6px 10px; border-radius: 6px; font-weight: 600; margin-bottom: 14px; }}
    .marca {{ font-weight: 700; color: #1D4ED8; letter-spacing: .02em; }}
    h1 {{ font-size: 18pt; margin: 2px 0 2px; }} .sub {{ color: #5B616E; margin: 0 0 12px; }}
    table {{ border-collapse: collapse; width: 100%; margin: 6px 0 10px; }} td {{ border: 1px solid #E2E4E9; padding: 5px 8px; vertical-align: top; }}
    td:first-child {{ width: 26%; color: #5B616E; }}
    h2 {{ font-size: 12pt; margin: 14px 0 4px; color: #1D4ED8; }} ul {{ margin: 0; padding-left: 18px; }} li {{ margin: 2px 0; }}
    .rodape {{ margin-top: 22px; padding-top: 8px; border-top: 1px solid #E2E4E9; color: #5B616E; font-size: 9pt; }}
    </style></head><body>{faixa}
    <div class="marca">BLITZ · TCC Equipe T03N</div>
    <h1>Ata da daily - {d['data']} (terça-feira)</h1>
    <p class="sub">{html.escape(d['sprint'])} · {html.escape(d['pauta'])}</p>
    <table><tr><td>Data</td><td>{d['data']}, duração de 15 minutos</td></tr>
    <tr><td>Participantes</td><td>{EQUIPE}</td></tr>
    <tr><td>Formato</td><td>Chamada online, daily semanal às terças-feiras</td></tr></table>
    {secao('O que foi feito desde a última daily', d['feito'])}
    {secao('O que será feito até a próxima', d['proximo'])}
    {secao('Impedimentos', d['impedimentos'])}
    {secao('Decisões e encaminhamentos', d['decisoes'])}
    </body></html>"""


def main():
    PASTA.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        for d in DAILIES:
            src = pathlib.Path(tmp) / (d["arquivo"] + ".html")
            src.write_text(pagina(d), encoding="utf-8")
            pdf = PASTA / (d["arquivo"] + ".pdf")
            subprocess.run([EDGE, "--headless", "--disable-gpu", "--no-pdf-header-footer", f"--print-to-pdf={pdf}", src.as_uri()],
                           check=True, capture_output=True, timeout=60)
            print(pdf.name, pdf.stat().st_size, "bytes")


if __name__ == "__main__":
    main()
