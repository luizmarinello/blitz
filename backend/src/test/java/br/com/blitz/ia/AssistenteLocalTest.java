package br.com.blitz.ia;

import static org.junit.jupiter.api.Assertions.*;

import br.com.blitz.ia.AssistenteLocal.Contexto;
import br.com.blitz.ia.AssistenteLocal.Intencao;
import br.com.blitz.ia.AssistenteLocal.Modo;
import br.com.blitz.tarefa.Prioridade;
import br.com.blitz.tarefa.StatusTarefa;
import br.com.blitz.tarefa.Tarefa;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** RF16/RF17: assistente local (sem LLM). Sem Spring e sem banco: só a lógica de intenção, priorização e resposta. */
class AssistenteLocalTest {
    static final LocalDate HOJE = LocalDate.of(2026, 11, 18);   // quarta-feira
    static final List<Modo> MODOS = List.of(new Modo("Pomodoro", 25, 5), new Modo("Profundo", 50, 10), new Modo("Relax", 20, 10));

    static Tarefa t(long id, String titulo, Prioridade p, LocalDate prazo, String horas, StatusTarefa s) {
        Tarefa t = new Tarefa();
        t.id = id; t.titulo = titulo; t.prioridade = p; t.prazo = prazo; t.status = s;
        t.horasEstimadas = horas == null ? null : new BigDecimal(horas);
        return t;
    }

    final Tarefa atrasadaBaixa = t(1, "Pagar boleto", Prioridade.BAIXA, HOJE.minusDays(2), "0.25", StatusTarefa.BACKLOG);
    final Tarefa altaSemPrazo = t(2, "Estudar arquitetura", Prioridade.ALTA, null, "3", StatusTarefa.BACKLOG);
    final Tarefa altaEm3Dias = t(3, "Relatório final do TCC", Prioridade.ALTA, HOJE.plusDays(3), "4", StatusTarefa.BACKLOG);
    final Tarefa baixaAmanha = t(4, "Responder e-mails", Prioridade.BAIXA, HOJE.plusDays(1), "0.5", StatusTarefa.BACKLOG);
    final Tarefa concluida = t(5, "Montar slides", Prioridade.MEDIA, HOJE, "1", StatusTarefa.CONCLUIDA);

    Contexto ctx(List<Tarefa> ts) { return new Contexto(ts, Map.of(3L, 5400L), 1800, 7200, 3, MODOS, HOJE); }
    Contexto ctx() { return ctx(List.of(atrasadaBaixa, altaSemPrazo, altaEm3Dias, baixaAmanha, concluida)); }
    String responder(String msg) { return AssistenteLocal.responder(msg, ctx()).texto(); }

    @Test void entendeAIntencao() {
        assertEquals(Intencao.AGORA, AssistenteLocal.intencao(AssistenteLocal.normalizar("O que devo fazer agora?")));
        assertEquals(Intencao.AGORA, AssistenteLocal.intencao(AssistenteLocal.normalizar("Ordene minhas tarefas por urgência")));
        assertEquals(Intencao.TEMPO, AssistenteLocal.intencao(AssistenteLocal.normalizar("Qual tarefa posso terminar em menos de 1 hora?")));
        assertEquals(Intencao.TEMPO, AssistenteLocal.intencao(AssistenteLocal.normalizar("tenho 30 min livres")));
        assertEquals(Intencao.PRAZOS, AssistenteLocal.intencao(AssistenteLocal.normalizar("O que vence hoje?")));
        assertEquals(Intencao.RESUMO, AssistenteLocal.intencao(AssistenteLocal.normalizar("Como foi minha semana?")));
        assertEquals(Intencao.RESUMO, AssistenteLocal.intencao(AssistenteLocal.normalizar("quanto foquei hoje")));
        assertEquals(Intencao.CARGA, AssistenteLocal.intencao(AssistenteLocal.normalizar("Vai dar tempo esta semana?")));
        assertEquals(Intencao.MODO, AssistenteLocal.intencao(AssistenteLocal.normalizar("Estou cansado, qual modo usar?")));
        assertEquals(Intencao.DICAS, AssistenteLocal.intencao(AssistenteLocal.normalizar("estou procrastinando muito")));
        assertEquals(Intencao.SAUDACAO, AssistenteLocal.intencao(AssistenteLocal.normalizar("Bom dia")));
        assertNull(AssistenteLocal.intencao(AssistenteLocal.normalizar("isso me incomoda")));   // " modo" não casa dentro de "incomoda"
    }

    @Test void leTempoDisponivel() {
        assertEquals(30, AssistenteLocal.minutosCitados("tenho 30 min"));
        assertEquals(90, AssistenteLocal.minutosCitados("tenho 1h30 livre"));
        assertEquals(90, AssistenteLocal.minutosCitados("tenho 1,5 hora"));
        assertEquals(30, AssistenteLocal.minutosCitados("tenho meia hora"));
        assertEquals(90, AssistenteLocal.minutosCitados("uma hora e meia"));
        assertNull(AssistenteLocal.minutosCitados("o que fazer agora"));
    }

    @Test void priorizaPorUrgenciaPrioridadeEEsforco() {
        List<Long> ordem = AssistenteLocal.ranking(ctx()).stream().map(a -> a.t().id).toList();
        // atrasada vence tudo; alta em 3 dias (75) passa baixa de amanhã (68); alta sem prazo por último; concluída fora
        assertEquals(List.of(1L, 3L, 4L, 2L), ordem);
        assertTrue(AssistenteLocal.avaliar(atrasadaBaixa, HOJE).motivos().contains("atrasada há 2 dias"));
    }

    @Test void respondeComOsDadosDaPessoa() {
        AssistenteLocal.Resposta agora = AssistenteLocal.responder("O que faço agora?", ctx());
        assertTrue(agora.texto().startsWith("Comece por \"Pagar boleto\""), agora.texto());
        assertEquals(List.of(1L, 3L, 4L, 2L), agora.ordem());

        String tempo = responder("Tenho 30 minutos, o que dá para fazer?");
        assertTrue(tempo.contains("Pagar boleto") && !tempo.contains("Relatório"), tempo);   // 15 min cabe; 4h não

        String prazos = responder("O que está atrasado?");
        assertTrue(prazos.contains("Atrasadas (1)") && prazos.contains("Responder e-mails"), prazos);

        String resumo = responder("Como foi minha semana?");
        assertTrue(resumo.contains("2h em 3 sessões") && resumo.contains("Relatório final do TCC"), resumo);   // foco e tarefa com mais foco vêm do contexto

        String modo = responder("Qual modo de foco usar no relatório final?");
        assertTrue(modo.contains("Modo sugerido para \"Relatório final do TCC\": Profundo"), modo);   // 4h estimadas pedem blocos longos
        assertTrue(responder("Estou cansado, qual modo usar?").contains("Para agora, Relax"));

        AssistenteLocal.Resposta dividir = AssistenteLocal.responder("Como dividir o relatório final?", ctx());
        assertEquals(List.of(3L), dividir.ordem());
        assertTrue(dividir.texto().contains("Profundo (50/10 min)") && dividir.texto().contains("5 blocos"), dividir.texto());   // 4h / 50 min

        AssistenteLocal.Resposta citada = AssistenteLocal.responder("e o relatório final do TCC?", ctx());
        assertTrue(citada.texto().contains("Foco já registrado nela: 1h30"), citada.texto());

        Tarefa status = t(6, "Relatório de status do projeto", Prioridade.MEDIA, null, null, StatusTarefa.BACKLOG);
        AssistenteLocal.Resposta sobre = AssistenteLocal.responder("e o relatório de status do projeto?", ctx(List.of(status)));
        assertTrue(sobre.texto().startsWith("\"Relatório de status do projeto\": a fazer"), sobre.texto());   // "status" do título não vira pedido de resumo

        Tarefa slides = t(7, "Revisar slides da apresentação", Prioridade.MEDIA, HOJE, "1", StatusTarefa.BACKLOG);
        AssistenteLocal.Resposta terminei = AssistenteLocal.responder("terminei os slides", ctx(List.of(slides, atrasadaBaixa)));
        assertTrue(terminei.texto().contains("\"Revisar slides da apresentação\" ainda aparece como a fazer"), terminei.texto());   // uma palavra única do título basta
        assertEquals(List.of(1L), terminei.ordem());

        String desconhecida = responder("qual a capital da França?");
        assertTrue(desconhecida.contains("ajuda") && desconhecida.contains("Pagar boleto"), desconhecida);
    }

    @Test void semTarefasOrientaOPrimeiroPasso() {
        AssistenteLocal.Resposta r = AssistenteLocal.responder("O que devo fazer agora?", ctx(List.of()));
        assertTrue(r.texto().contains("Cadastre a primeira"));
        assertTrue(r.ordem().isEmpty());
    }
}
