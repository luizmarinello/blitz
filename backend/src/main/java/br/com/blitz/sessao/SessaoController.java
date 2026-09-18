package br.com.blitz.sessao;

import br.com.blitz.auth.UsuarioAutenticado;
import br.com.blitz.comum.NaoEncontrado;
import br.com.blitz.modo.ModoRepository;
import br.com.blitz.tarefa.TarefaRepository;
import jakarta.validation.constraints.NotNull;
import java.time.*;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/** UC03 Gerenciar Tempo de Foco Diário. RF10, RF11, RF14, RN03. */
@RestController
@RequestMapping("/api")
public class SessaoController {
    // ponytail: fuso fixo pt-BR (RNF07); virar preferência do usuário se aparecer alguém fora do Brasil
    private static final ZoneId FUSO = ZoneId.of("America/Sao_Paulo");

    private final SessaoRepository sessoes;
    private final ModoRepository modos;
    private final TarefaRepository tarefas;

    SessaoController(SessaoRepository sessoes, ModoRepository modos, TarefaRepository tarefas) {
        this.sessoes = sessoes; this.modos = modos; this.tarefas = tarefas;
    }

    public record Inicio(@NotNull(message = "Escolha um modo de concentração.") Long modoId, Long tarefaId) {}
    public record Encerrar(Integer segundosAtivos) {}

    @PostMapping("/sessoes") @ResponseStatus(HttpStatus.CREATED)
    public SessaoFoco iniciar(@AuthenticationPrincipal UsuarioAutenticado ua, @RequestBody @Validated Inicio e) {
        if (sessoes.findFirstByUsuarioIdAndFimIsNull(ua.id()).isPresent())
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Já existe uma sessão em andamento. Encerre-a antes de iniciar outra.");
        modos.visivelPara(e.modoId(), ua.id()).orElseThrow(() -> new NaoEncontrado("Modo"));
        if (e.tarefaId() != null) tarefas.doUsuario(e.tarefaId(), ua.id()).orElseThrow(() -> new NaoEncontrado("Tarefa"));

        SessaoFoco s = new SessaoFoco();
        s.usuarioId = ua.id();
        s.modoId = e.modoId();
        s.tarefaId = e.tarefaId();
        return sessoes.save(s);
    }

    @GetMapping("/sessoes/ativa")
    public ResponseEntity<SessaoFoco> ativa(@AuthenticationPrincipal UsuarioAutenticado ua) {
        return sessoes.findFirstByUsuarioIdAndFimIsNull(ua.id()).map(ResponseEntity::ok).orElse(ResponseEntity.noContent().build());
    }

    /** Pausas são controladas no cliente; ele informa os segundos efetivamente ativos, limitados ao tempo decorrido real. */
    @PostMapping("/sessoes/{id}/encerrar")
    public SessaoFoco encerrar(@AuthenticationPrincipal UsuarioAutenticado ua, @PathVariable Long id, @RequestBody(required = false) Encerrar e) {
        SessaoFoco s = sessoes.findByIdAndUsuarioId(id, ua.id()).orElseThrow(() -> new NaoEncontrado("Sessão"));
        if (s.fim != null) return s;
        s.fim = Instant.now();
        int decorrido = (int) Duration.between(s.inicio, s.fim).getSeconds();
        Integer ativos = e == null ? null : e.segundosAtivos();
        s.duracaoSegundos = ativos == null ? decorrido : Math.max(0, Math.min(ativos, decorrido));
        return sessoes.save(s);
    }

    /** Descarta uma sessão ainda em andamento (ex.: iniciada por engano). Sessões encerradas nunca são apagadas (RN03). */
    @DeleteMapping("/sessoes/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void descartar(@AuthenticationPrincipal UsuarioAutenticado ua, @PathVariable Long id) {
        SessaoFoco s = sessoes.findByIdAndUsuarioId(id, ua.id()).orElseThrow(() -> new NaoEncontrado("Sessão"));
        if (s.fim != null) throw new ResponseStatusException(HttpStatus.CONFLICT, "Sessões encerradas fazem parte do histórico e não podem ser apagadas.");
        sessoes.delete(s);
    }

    @GetMapping("/sessoes")
    public List<SessaoFoco> historico(@AuthenticationPrincipal UsuarioAutenticado ua) {
        return sessoes.findTop50ByUsuarioIdAndFimIsNotNullOrderByInicioDesc(ua.id());
    }

    /** RF14: métricas de foco. Agregação em memória sobre os últimos 7 dias (volume por usuário é pequeno). */
    @GetMapping("/metricas")
    public Map<String, Object> metricas(@AuthenticationPrincipal UsuarioAutenticado ua) {
        LocalDate hoje = LocalDate.now(FUSO);
        Instant desde = hoje.minusDays(6).atStartOfDay(FUSO).toInstant();
        List<SessaoFoco> semana = sessoes.findByUsuarioIdAndFimIsNotNullAndInicioAfter(ua.id(), desde);

        Map<LocalDate, Long> porDia = new LinkedHashMap<>();
        for (int i = 6; i >= 0; i--) porDia.put(hoje.minusDays(i), 0L);
        long semanaSeg = 0;
        for (SessaoFoco s : semana) {
            LocalDate d = s.inicio.atZone(FUSO).toLocalDate();
            long seg = s.duracaoSegundos == null ? 0 : s.duracaoSegundos;
            porDia.computeIfPresent(d, (k, v) -> v + seg);
            semanaSeg += seg;
        }
        List<Map<String, Object>> dias = new ArrayList<>();
        porDia.forEach((d, seg) -> dias.add(Map.of("dia", d.toString(), "segundos", seg)));

        long totalSessoes = sessoes.countByUsuarioIdAndFimIsNotNull(ua.id());
        return Map.of(
            "hojeSegundos", porDia.get(hoje),
            "semanaSegundos", semanaSeg,
            "porDia", dias,
            "totalSessoes", totalSessoes,
            "sessoesSemana", semana.size(),
            "mediaSessaoSemanaSegundos", semana.isEmpty() ? 0 : semanaSeg / semana.size(),
            "tarefasConcluidas", tarefas.concluidasDoUsuario(ua.id())
        );
    }
}
