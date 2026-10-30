package br.com.blitz.ia;

import br.com.blitz.auth.UsuarioAutenticado;
import br.com.blitz.tarefa.Prioridade;
import br.com.blitz.tarefa.StatusTarefa;
import br.com.blitz.tarefa.Tarefa;
import br.com.blitz.tarefa.TarefaRepository;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

/**
 * UC04 Conversar com IA Integrada. RF15 (conversar), RF16 (sugerir prioridade), RF17 (resposta alternativa quando a IA falha),
 * RNF09 (limite por usuário), RNF-LGPD07 (payload mínimo).
 */
@RestController
@RequestMapping("/api/ia")
public class IaController {
    private static final Logger log = LoggerFactory.getLogger(IaController.class);
    private static final Duration JANELA = Duration.ofHours(24);

    private final GeminiClient gemini;
    private final ConversaRepository conversas;
    private final TarefaRepository tarefas;
    private final long limiteTokensDia;
    private final String sal;

    IaController(GeminiClient gemini, ConversaRepository conversas, TarefaRepository tarefas,
                 @Value("${blitz.ia.limite-tokens-dia}") long limiteTokensDia,
                 @Value("${blitz.ia.pseudonimo-sal}") String sal) {
        this.gemini = gemini; this.conversas = conversas; this.tarefas = tarefas;
        this.limiteTokensDia = limiteTokensDia; this.sal = sal;
    }

    public record Mensagem(@NotBlank(message = "Escreva uma mensagem.") @Size(max = 2000, message = "Mensagem longa demais (máx. 2000).") String mensagem) {}

    @GetMapping("/limite")
    public Map<String, Object> limite(@AuthenticationPrincipal UsuarioAutenticado ua) { return limiteDe(ua.id()); }

    @GetMapping("/historico")
    public List<Map<String, Object>> historico(@AuthenticationPrincipal UsuarioAutenticado ua) {
        List<ConversaIa> lista = conversas.findTop20ByUsuarioIdOrderByDataHoraDesc(ua.id());
        Collections.reverse(lista);
        List<Map<String, Object>> saida = new ArrayList<>();
        for (ConversaIa c : lista) {
            if (RetencaoConversas.MARCA.equals(c.mensagem)) continue;   // conteúdo já apagado pela retenção
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", c.id); m.put("mensagem", c.mensagem); m.put("resposta", c.resposta); m.put("dataHora", c.dataHora);
            saida.add(m);
        }
        return saida;
    }

    @PostMapping("/mensagem")
    public ResponseEntity<Map<String, Object>> conversar(@AuthenticationPrincipal UsuarioAutenticado ua, @RequestBody @Validated Mensagem m) {
        long inicio = System.nanoTime();
        Map<String, Object> limite = limiteDe(ua.id());

        // RNF09: ao atingir o limite, avisar quando renova e não bloquear o resto do app (o front segue funcionando)
        if ((long) limite.get("usados") >= limiteTokensDia) {
            registrar(ua.id(), 0, inicio, "LIMITE");
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(Map.of(
                "mensagem", "Você atingiu o limite diário do assistente. Ele volta em " + limite.get("renovaEm") + ". As demais funções continuam disponíveis.",
                "limite", limite));
        }

        List<Tarefa> pendentes = tarefas.todasDoUsuario(ua.id()).stream().filter(t -> t.status != StatusTarefa.CONCLUIDA).toList();

        String resposta;
        int tokens = 0;
        boolean fallback = false;
        try {
            List<GeminiClient.Turno> hist = new ArrayList<>();
            for (Map<String, Object> h : historico(ua)) {
                if (h.get("resposta") == null) continue;
                hist.add(new GeminiClient.Turno("user", (String) h.get("mensagem")));
                hist.add(new GeminiClient.Turno("model", (String) h.get("resposta")));
            }
            if (hist.size() > 8) hist = hist.subList(hist.size() - 8, hist.size());
            GeminiClient.Resposta r = gemini.gerar(instrucao(pendentes), hist, m.mensagem());
            resposta = r.texto();
            tokens = r.tokens();
            registrar(ua.id(), tokens, inicio, "OK");
        } catch (Exception e) {
            // RF17 / achado IA-04: provedor indisponível => resposta alternativa determinística. Log só com a classe do erro.
            fallback = true;
            resposta = respostaAlternativa(pendentes);
            registrar(ua.id(), 0, inicio, "FALLBACK:" + e.getClass().getSimpleName());
        }

        ConversaIa c = new ConversaIa();
        c.usuarioId = ua.id();
        c.mensagem = m.mensagem();
        c.resposta = resposta;
        c.tokensUsados = tokens;
        conversas.save(c);

        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("resposta", resposta);
        corpo.put("tokensUsados", tokens);
        corpo.put("fallback", fallback);
        corpo.put("limite", limiteDe(ua.id()));
        return ResponseEntity.ok(corpo);
    }

    // ---------- payload mínimo (RNF-LGPD07): só título, prioridade, prazo, horas, status ----------

    private static String instrucao(List<Tarefa> pendentes) {
        StringBuilder sb = new StringBuilder("""
            Você é o assistente do Blitz, um app de foco e produtividade. Responda sempre em português do Brasil, de forma direta e curta.
            Sua função principal é ajudar a pessoa a decidir o que fazer AGORA, ordenando as tarefas pendentes por prazo, prioridade e esforço.
            Quando sugerir ordem, liste no máximo 5 itens numerados e explique cada escolha em uma frase.
            Não invente tarefas: use apenas as listadas abaixo. Se não houver tarefas, sugira cadastrar a primeira.
            Hoje é """).append(LocalDate.now()).append(".\n\nTarefas pendentes:\n");
        if (pendentes.isEmpty()) sb.append("(nenhuma)\n");
        for (Tarefa t : pendentes) {
            sb.append("- ").append(t.titulo)
              .append(" | prioridade ").append(t.prioridade)
              .append(" | status ").append(t.status)
              .append(t.prazo == null ? "" : " | prazo " + t.prazo)
              .append(t.horasEstimadas == null ? "" : " | " + t.horasEstimadas.stripTrailingZeros().toPlainString() + "h")
              .append('\n');
        }
        return sb.toString();
    }

    /** RF17: ordenação determinística (prazo mais próximo, prioridade mais alta, menor esforço). Também cobre RF16 sem IA. */
    static String respostaAlternativa(List<Tarefa> pendentes) {
        if (pendentes.isEmpty())
            return "O assistente de IA está indisponível no momento. Você ainda não tem tarefas pendentes: cadastre a primeira no quadro e eu ajudo a priorizar.";
        Comparator<Tarefa> ordem = Comparator
            .comparing((Tarefa t) -> t.prazo, Comparator.nullsLast(Comparator.naturalOrder()))
            .thenComparing(t -> peso(t.prioridade))
            .thenComparing(t -> t.horasEstimadas, Comparator.nullsLast(Comparator.naturalOrder()));
        List<Tarefa> top = pendentes.stream().sorted(ordem).limit(5).toList();
        StringBuilder sb = new StringBuilder("O assistente de IA está indisponível no momento. Sugestão automática com base em prazo, prioridade e esforço:\n");
        int i = 1;
        for (Tarefa t : top) {
            sb.append(i++).append(". ").append(t.titulo).append(" (prioridade ").append(rotulo(t.prioridade));
            if (t.prazo != null) sb.append(", prazo ").append(t.prazo.format(DATA_BR));
            sb.append(")\n");
        }
        return sb.toString().trim();
    }

    private static final java.time.format.DateTimeFormatter DATA_BR = java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static String rotulo(Prioridade p) { return p == Prioridade.ALTA ? "alta" : p == Prioridade.MEDIA ? "média" : "baixa"; }
    private static int peso(Prioridade p) { return p == Prioridade.ALTA ? 0 : p == Prioridade.MEDIA ? 1 : 2; }

    // ---------- limite (RNF09) ----------

    private Map<String, Object> limiteDe(Long usuarioId) {
        Instant desde = Instant.now().minus(JANELA);
        long usados = conversas.tokensDesde(usuarioId, desde);
        Instant renovaEm = conversas.findFirstByUsuarioIdAndDataHoraAfterAndTokensUsadosGreaterThanOrderByDataHoraAsc(usuarioId, desde, 0)
            .map(c -> c.dataHora.plus(JANELA)).orElse(Instant.now().plus(JANELA));
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("usados", usados);
        m.put("maximo", limiteTokensDia);
        m.put("renovaEm", renovaEm.toString());
        m.put("configurado", gemini.configurado());
        return m;
    }

    // ---------- log (seção 7): data/hora, pseudônimo, tokens, latência, código. Nunca conteúdo. ----------

    private void registrar(Long usuarioId, int tokens, long inicioNanos, String codigo) {
        long ms = (System.nanoTime() - inicioNanos) / 1_000_000;
        log.info("ia usuario={} tokens={} latenciaMs={} resultado={}", pseudonimo(usuarioId), tokens, ms, codigo);
    }

    private String pseudonimo(Long id) {
        try {
            byte[] h = MessageDigest.getInstance("SHA-256").digest((sal + ":" + id).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(h, 0, 6);
        } catch (Exception e) {
            return "?";
        }
    }
}
