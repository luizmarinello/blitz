package br.com.blitz.tarefa;

import br.com.blitz.auth.UsuarioAutenticado;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

/**
 * RF09 Organização automática em sprints. Heurística determinística (mesma ordem do fallback da IA: prazo, prioridade,
 * esforço) preenchendo a semana até a capacidade em horas. Tarefa sem estimativa conta como 1 h.
 * ponytail: só a sprint da semana corrente; planejar semanas futuras quando alguém pedir.
 */
@RestController
@RequestMapping("/api/sprints")
public class SprintController {
    private static final ZoneId FUSO = ZoneId.of("America/Sao_Paulo");
    private static final BigDecimal UMA_HORA = BigDecimal.ONE;

    private final SprintRepository sprints;
    private final TarefaRepository tarefas;

    SprintController(SprintRepository sprints, TarefaRepository tarefas) { this.sprints = sprints; this.tarefas = tarefas; }

    public record Planejar(@Min(value = 1, message = "Capacidade mínima: 1 hora.") @Max(value = 168, message = "Capacidade máxima: 168 horas.") Integer capacidadeHoras) {}

    @GetMapping("/atual")
    public ResponseEntity<Map<String, Object>> atual(@AuthenticationPrincipal UsuarioAutenticado ua) {
        return sprints.vigente(ua.id(), LocalDate.now(FUSO))
            .map(s -> ResponseEntity.ok(resumo(s, tarefas.todasDoUsuario(ua.id()), null)))
            .orElse(ResponseEntity.noContent().build());
    }

    @PostMapping("/planejar")
    @Transactional
    public Map<String, Object> planejar(@AuthenticationPrincipal UsuarioAutenticado ua, @RequestBody(required = false) @Validated Planejar p) {
        int capacidade = p == null || p.capacidadeHoras() == null ? 20 : p.capacidadeHoras();
        LocalDate hoje = LocalDate.now(FUSO);
        Sprint s = sprints.vigente(ua.id(), hoje).orElseGet(() -> {
            Sprint nova = new Sprint();
            nova.usuarioId = ua.id();
            nova.dataInicio = hoje.with(DayOfWeek.MONDAY);
            nova.dataFim = hoje.with(DayOfWeek.SUNDAY);
            nova.geradaPorIa = false;   // heurística local, não é o provedor de IA
            return sprints.save(nova);
        });

        List<Tarefa> todas = tarefas.todasDoUsuario(ua.id());
        List<Tarefa> pendentes = todas.stream().filter(t -> t.status != StatusTarefa.CONCLUIDA).sorted(Comparator
            .comparing((Tarefa t) -> t.prazo, Comparator.nullsLast(Comparator.naturalOrder()))
            .thenComparing(t -> t.prioridade == Prioridade.ALTA ? 0 : t.prioridade == Prioridade.MEDIA ? 1 : 2)
            .thenComparing(t -> t.horasEstimadas, Comparator.nullsLast(Comparator.naturalOrder()))).toList();

        BigDecimal usado = BigDecimal.ZERO, limite = BigDecimal.valueOf(capacidade);
        int fora = 0;
        for (Tarefa t : pendentes) {
            BigDecimal h = t.horasEstimadas == null ? UMA_HORA : t.horasEstimadas;
            if (usado.add(h).compareTo(limite) <= 0) { t.sprintId = s.id; usado = usado.add(h); }
            else { if (s.id.equals(t.sprintId)) t.sprintId = null; fora++; }
        }
        tarefas.saveAll(pendentes);
        return resumo(s, pendentes, fora);
    }

    private static Map<String, Object> resumo(Sprint s, List<Tarefa> todas, Integer fora) {
        List<Tarefa> na = todas.stream().filter(t -> s.id.equals(t.sprintId) && t.status != StatusTarefa.CONCLUIDA).toList();
        BigDecimal horas = na.stream().map(t -> t.horasEstimadas == null ? UMA_HORA : t.horasEstimadas).reduce(BigDecimal.ZERO, BigDecimal::add);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("sprint", s);
        m.put("tarefas", na.size());
        m.put("horasPlanejadas", horas);
        if (fora != null) m.put("foraDaSprint", fora);
        return m;
    }
}
