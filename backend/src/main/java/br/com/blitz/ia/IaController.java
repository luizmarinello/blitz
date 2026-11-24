package br.com.blitz.ia;

import br.com.blitz.auth.UsuarioAutenticado;
import br.com.blitz.modo.ModoRepository;
import br.com.blitz.sessao.SessaoFoco;
import br.com.blitz.sessao.SessaoRepository;
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
    private final SessaoRepository sessoes;
    private final ModoRepository modos;
    private final long limiteTokensDia;
    private final String sal;

    IaController(GeminiClient gemini, ConversaRepository conversas, TarefaRepository tarefas, SessaoRepository sessoes, ModoRepository modos,
                 @Value("${blitz.ia.limite-tokens-dia}") long limiteTokensDia,
                 @Value("${blitz.ia.pseudonimo-sal}") String sal) {
        this.gemini = gemini; this.conversas = conversas; this.tarefas = tarefas; this.sessoes = sessoes; this.modos = modos;
        this.limiteTokensDia = limiteTokensDia; this.sal = sal;
    }

    /**
     * tela/itens: onde a pessoa está e as partes da tela que o Bolt pode apontar (data-bolt no front). Só rótulos fixos do
     * produto, nunca conteúdo da pessoa (RNF-LGPD07); o formato é conferido antes de ir para o prompt.
     */
    public record Mensagem(@NotBlank(message = "Escreva uma mensagem.") @Size(max = 2000, message = "Mensagem longa demais (máx. 2000).") String mensagem,
                           @Size(max = 40) String tela,
                           @Size(max = 20) List<@Size(max = 40) String> itens) {}

    private static final java.util.regex.Pattern ROTULO = java.util.regex.Pattern.compile("^[\\p{L}0-9 ]{1,40}$");
    static List<String> rotulos(List<String> l) {
        return l == null ? List.of() : l.stream().filter(x -> x != null && ROTULO.matcher(x).matches()).distinct().toList();
    }

    /** "Limpar a conversa" do Bolt: some o texto; data e tokens ficam para o limite diário (RNF09). */
    @DeleteMapping("/historico")
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<Void> limparHistorico(@AuthenticationPrincipal UsuarioAutenticado ua) {
        conversas.apagarConteudoDe(ua.id(), RetencaoConversas.MARCA);
        return ResponseEntity.noContent().build();
    }

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

        List<Tarefa> todas = tarefas.todasDoUsuario(ua.id());
        List<Tarefa> pendentes = todas.stream().filter(t -> t.status != StatusTarefa.CONCLUIDA).toList();

        String resposta;
        int tokens = 0;
        boolean fallback = false;
        List<Long> sugeridas = List.of();   // ids das tarefas na ordem sugerida: o front oferece "Focar na primeira" e "Aplicar ordem no quadro"
        boolean noLimite = (long) limite.get("usados") >= limiteTokensDia;
        if (!gemini.configurado() || noLimite) {
            // RF17 sem chave da IA, ou RNF09 com o limite diário atingido: o assistente local responde (0 token, não pesa no limite)
            AssistenteLocal.Resposta r = AssistenteLocal.responder(m.mensagem(), contexto(ua.id(), todas));
            fallback = true;
            resposta = noLimite
                ? "Você atingiu o limite diário da IA (renova " + quando((String) limite.get("renovaEm")) + "). Resposta automática:\n\n" + r.texto()
                : r.texto();
            sugeridas = r.ordem();
            registrar(ua.id(), 0, inicio, noLimite ? "LIMITE_LOCAL" : "LOCAL");
        } else try {
            List<GeminiClient.Turno> hist = new ArrayList<>();
            for (Map<String, Object> h : historico(ua)) {
                if (h.get("resposta") == null) continue;
                hist.add(new GeminiClient.Turno("user", (String) h.get("mensagem")));
                hist.add(new GeminiClient.Turno("model", (String) h.get("resposta")));
            }
            if (hist.size() > 8) hist = hist.subList(hist.size() - 8, hist.size());
            String tela = m.tela() != null && ROTULO.matcher(m.tela()).matches() ? m.tela() : null;
            GeminiClient.Resposta r = gemini.gerar(instrucao(pendentes, tela, rotulos(m.itens())), hist, m.mensagem());
            sugeridas = extrairOrdem(r.texto(), pendentes);
            resposta = ORDEM.matcher(r.texto()).replaceAll("").strip();   // a linha ORDEM é só para o front, não para a pessoa
            tokens = r.tokens();
            registrar(ua.id(), tokens, inicio, "OK");
        } catch (Exception e) {
            // RF17 / achado IA-04: provedor indisponível => assistente local. Log só com a classe do erro.
            AssistenteLocal.Resposta r = AssistenteLocal.responder(m.mensagem(), contexto(ua.id(), todas));
            fallback = true;
            resposta = r.texto();
            sugeridas = r.ordem();
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
        corpo.put("tarefasSugeridas", sugeridas);
        corpo.put("limite", limiteDe(ua.id()));
        return ResponseEntity.ok(corpo);
    }

    // ---------- payload mínimo (RNF-LGPD07): só título, prioridade, prazo, horas, status ----------

    static String instrucao(List<Tarefa> pendentes, String tela, List<String> itens) {
        StringBuilder sb = new StringBuilder("""
            Você é o assistente do Blitz, um app de foco e produtividade. Responda sempre em português do Brasil, de forma direta e curta.
            Sua função principal é ajudar a pessoa a decidir o que fazer AGORA, ordenando as tarefas pendentes por prazo, prioridade e esforço.
            Quando sugerir ordem, liste no máximo 5 itens numerados e explique cada escolha em uma frase.
            Nesse caso, termine a resposta com uma última linha no formato exato "ORDEM: 12,7,3", com os ids [#id] das tarefas na ordem sugerida, sem comentar essa linha.
            Não invente tarefas: use apenas as listadas abaixo. Se não houver tarefas, sugira cadastrar a primeira.
            Seu nome é Bolt. Você também explica as telas do Blitz e mostra onde fica cada coisa.
            Hoje é """).append(LocalDate.now()).append(".\n");
        if (tela != null) {
            sb.append("\nA pessoa está na tela ").append(tela).append('.');
            String sobre = TelasBlitz.descricao(tela);
            if (sobre != null) sb.append(" Sobre ela: ").append(sobre.replace("[[", "").replace("]]", ""));
            sb.append('\n');
        }
        if (!itens.isEmpty()) {
            sb.append("Partes desta tela que você pode mostrar: ").append(String.join(", ", itens)).append(".\n")
              .append("Quando citar uma delas, escreva o nome exatamente entre colchetes duplos, por exemplo [[")
              .append(itens.get(0)).append("]]. Não use colchetes duplos para mais nada.\n");
        }
        sb.append("\nTarefas pendentes:\n");
        if (pendentes.isEmpty()) sb.append("(nenhuma)\n");
        for (Tarefa t : pendentes) {
            sb.append("- [#").append(t.id).append("] ").append(t.titulo)
              .append(" | prioridade ").append(t.prioridade)
              .append(" | status ").append(t.status)
              .append(t.prazo == null ? "" : " | prazo " + t.prazo)
              .append(t.horasEstimadas == null ? "" : " | " + t.horasEstimadas.stripTrailingZeros().toPlainString() + "h")
              .append('\n');
        }
        return sb.toString();
    }

    /** Dados para o assistente local: tarefas, foco dos últimos 7 dias e por tarefa, modos visíveis. Nada sai do servidor. */
    private AssistenteLocal.Contexto contexto(Long u, List<Tarefa> todas) {
        LocalDate hoje = LocalDate.now(AssistenteLocal.FUSO);
        Instant inicioHoje = hoje.atStartOfDay(AssistenteLocal.FUSO).toInstant();
        List<SessaoFoco> semana = sessoes.findByUsuarioIdAndFimIsNotNullAndInicioAfter(u, hoje.minusDays(6).atStartOfDay(AssistenteLocal.FUSO).toInstant());
        long focoSemana = 0, focoHoje = 0;
        for (SessaoFoco s : semana) {
            long d = s.duracaoSegundos == null ? 0 : s.duracaoSegundos;
            focoSemana += d;
            if (!s.inicio.isBefore(inicioHoje)) focoHoje += d;
        }
        Map<Long, Long> porTarefa = new HashMap<>();
        for (Object[] l : sessoes.focoPorTarefa(u)) porTarefa.put(((Number) l[0]).longValue(), ((Number) l[1]).longValue());
        List<AssistenteLocal.Modo> ms = modos.visiveisPara(u).stream().map(x -> new AssistenteLocal.Modo(x.nome, x.cicloFocoMin, x.cicloPausaMin)).toList();
        return new AssistenteLocal.Contexto(todas, porTarefa, focoHoje, focoSemana, semana.size(), ms, hoje);
    }

    private static String quando(String isoInstant) {
        return java.time.format.DateTimeFormatter.ofPattern("dd/MM 'às' HH:mm").format(Instant.parse(isoInstant).atZone(AssistenteLocal.FUSO));
    }

    /** Linha "ORDEM: 12,7,3" (ou "#12, #7") no fim da resposta do modelo; só ids de tarefas pendentes da pessoa valem. */
    static final java.util.regex.Pattern ORDEM = java.util.regex.Pattern.compile("(?mi)^\\s*ORDEM:\\s*([\\d,#\\s]+)\\s*$");
    static List<Long> extrairOrdem(String texto, List<Tarefa> pendentes) {
        var m = ORDEM.matcher(texto);
        if (!m.find()) return List.of();
        Set<Long> validos = new HashSet<>(); pendentes.forEach(t -> validos.add(t.id));
        List<Long> ids = new ArrayList<>();
        for (String s : m.group(1).replace("#", "").split("[,\\s]+")) {
            if (s.isBlank()) continue;
            try { long id = Long.parseLong(s); if (validos.contains(id) && !ids.contains(id)) ids.add(id); } catch (NumberFormatException ignorada) { /* texto que não é id */ }
        }
        return ids;
    }

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
