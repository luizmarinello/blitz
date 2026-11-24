package br.com.blitz.ia;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * O que cada tela do Blitz faz, para o agente Bolt explicar (UC04, RF15). Os nomes entre [[ ]] são partes da tela marcadas
 * no front com data-bolt="Nome": o Bolt vira esse nome num botão que leva até a parte e a destaca. Só texto fixo do produto,
 * nenhum dado da pessoa. O mesmo texto serve ao assistente local (resposta direta) e ao Gemini (contexto da tela aberta).
 */
final class TelasBlitz {
    private TelasBlitz() {}

    /** Chave: nome da tela normalizado (sem acento, minúsculo), igual ao que o front mostra no "Com você em". */
    private static final Map<String, String> TELAS = new LinkedHashMap<>();
    static {
        TELAS.put("painel", """
            O Painel é a sua central. Em [[Foco rápido]] você escolhe o modo e inicia uma sessão sem sair daqui. Em [[Sprint]] você \
            informa quantas horas tem na semana e o Blitz separa as tarefas que cabem nelas. [[Hoje]] mostra o foco do dia e da semana.
            Para criar tarefas, use a [[Entrada rápida]] (por exemplo, "Revisar slides !alta @sexta 2h") ou [[Nova tarefa]] para o \
            formulário completo. O [[Quadro]] tem três colunas: A fazer, Em andamento e Concluída. Arraste os cartões ou use as setas \
            de cada um. O cartão marcado [[Comece por aqui]] é o que eu sugiro fazer primeiro.""");
        TELAS.put("foco", """
            Aqui você inicia uma sessão de foco: escolha o [[Modo]] (Pomodoro, Profundo, Relax ou um seu), a [[Tarefa]] em que vai \
            trabalhar, se quiser, e clique em [[Iniciar sessão]]. Durante a sessão dá para pausar, pular a fase ou encerrar. O tempo \
            focado vira métrica, mesmo que a tarefa seja apagada depois.""");
        TELAS.put("modos", """
            Os modos definem os ciclos de foco e pausa. Os [[Predefinidos]] são Pomodoro, Profundo e Relax. Em [[Novo modo]] você \
            cria o seu, com os minutos que preferir, e ele aparece em [[Meus modos]]. Um modo que já foi usado em alguma sessão não \
            pode ser excluído, para o histórico não perder o sentido.""");
        TELAS.put("metricas", """
            Os [[Números]] mostram o foco de hoje e dos últimos 7 dias, as sessões e as tarefas concluídas. Quando há foco na semana, \
            [[Sua semana]] aparece em cima com um resumo: sequência de dias, melhor dia e a tarefa com mais foco. [[Foco por dia]] \
            mostra quanto você focou em cada dia, [[Sessões recentes]] lista as últimas sessões e [[Tarefas concluídas]] guarda o \
            histórico do que você terminou.""");
        TELAS.put("perfil", """
            Em [[Dados da conta]] você corrige o seu nome e em [[Trocar senha]] muda a senha. Os atalhos levam às preferências de \
            acessibilidade e à tela de privacidade.""");
        TELAS.put("acessibilidade", """
            Aqui você ajusta o [[Tema]] (claro, escuro ou alto contraste), o [[Tamanho da fonte]] e a redução de animações. \
            A escolha vale em todas as telas e fica salva na sua conta.""");
        TELAS.put("privacidade", """
            [[O que guardamos]] explica quais dados o Blitz trata e para quê. [[Seus consentimentos]] mostra cada aceite dos termos, \
            com data e versão da política. Em [[Seus direitos]] você corrige, exporta ou exclui os seus dados.""");
        TELAS.put("tarefa", """
            Aqui você vê e edita uma tarefa: título, descrição, prioridade, prazo e horas estimadas. Também dá para focar nela ou \
            excluí-la. O tempo de foco já registrado nela continua nas métricas.""");
    }

    /** "Me explica a tela Painel: ..." (a dica de primeira visita e o primeiro chip do Bolt mandam exatamente isso). */
    private static final Pattern PEDIDO = Pattern.compile("^me explica a tela ([a-z ]+?)\\s*(?:[:?.].*)?$");

    /** Descrição da tela pelo nome mostrado no front ("Métricas", "Painel"); null se não existir. */
    static String descricao(String nomeTela) {
        return nomeTela == null ? null : TELAS.get(AssistenteLocal.normalizar(nomeTela));
    }

    /** Se a mensagem (já normalizada) pede a explicação de uma tela conhecida, devolve a descrição; senão null. */
    static String pedidoDeExplicacao(String norm) {
        Matcher m = PEDIDO.matcher(norm);
        return m.matches() ? TELAS.get(m.group(1).trim()) : null;
    }
}
