package br.com.blitz.tarefa;

import br.com.blitz.auth.UsuarioAutenticado;
import br.com.blitz.comum.NaoEncontrado;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/** UC02 Criar e Gerenciar Listas de Tarefas. RF05–RF08, RN02 (concluídas ficam no histórico, nunca somem). */
@RestController
@RequestMapping("/api")
public class QuadroController {
    private final ListaRepository listas;
    private final TarefaRepository tarefas;
    QuadroController(ListaRepository listas, TarefaRepository tarefas) { this.listas = listas; this.tarefas = tarefas; }

    public record ListaEntrada(@NotBlank(message = "Dê um nome à lista.") @Size(max = 120) String nome) {}

    public record TarefaEntrada(
        @NotBlank(message = "Informe o título.") @Size(max = 200) String titulo,
        @Size(max = 4000) String descricao,
        Prioridade prioridade,
        LocalDate prazo,
        @Positive(message = "Horas estimadas devem ser maiores que zero.") @Digits(integer = 3, fraction = 2) BigDecimal horasEstimadas,
        StatusTarefa status,
        Long listaId) {}

    public record StatusEntrada(@NotNull StatusTarefa status) {}

    // ---------- listas ----------

    @GetMapping("/listas")
    public List<Lista> listas(@AuthenticationPrincipal UsuarioAutenticado ua) { return listas.findByUsuarioIdOrderByPosicaoAscIdAsc(ua.id()); }

    @PostMapping("/listas") @ResponseStatus(HttpStatus.CREATED)
    public Lista criarLista(@AuthenticationPrincipal UsuarioAutenticado ua, @RequestBody @Validated ListaEntrada e) {
        Lista l = new Lista();
        l.usuarioId = ua.id();
        l.nome = e.nome().trim();
        l.posicao = (int) listas.countByUsuarioId(ua.id());
        return listas.save(l);
    }

    @PutMapping("/listas/{id}")
    public Lista renomearLista(@AuthenticationPrincipal UsuarioAutenticado ua, @PathVariable Long id, @RequestBody @Validated ListaEntrada e) {
        Lista l = minhaLista(ua, id);
        l.nome = e.nome().trim();
        return listas.save(l);
    }

    @DeleteMapping("/listas/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void excluirLista(@AuthenticationPrincipal UsuarioAutenticado ua, @PathVariable Long id) {
        if (listas.countByUsuarioId(ua.id()) <= 1)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Mantenha pelo menos uma lista.");
        listas.delete(minhaLista(ua, id));   // tarefas caem em cascata; sessoes ficam com tarefa_id NULL (RN03)
    }

    // ---------- tarefas ----------

    @GetMapping("/tarefas")
    public List<Tarefa> tarefas(@AuthenticationPrincipal UsuarioAutenticado ua) { return tarefas.todasDoUsuario(ua.id()); }

    @GetMapping("/tarefas/{id}")
    public Tarefa tarefa(@AuthenticationPrincipal UsuarioAutenticado ua, @PathVariable Long id) { return minhaTarefa(ua, id); }

    @PostMapping("/listas/{listaId}/tarefas") @ResponseStatus(HttpStatus.CREATED)
    public Tarefa criarTarefa(@AuthenticationPrincipal UsuarioAutenticado ua, @PathVariable Long listaId, @RequestBody @Validated TarefaEntrada e) {
        Lista l = minhaLista(ua, listaId);
        Tarefa t = new Tarefa();
        t.listaId = l.id;
        t.posicao = tarefas.proximaPosicao(l.id);
        return tarefas.save(aplicar(ua, t, e));
    }

    @PutMapping("/tarefas/{id}")
    public Tarefa editarTarefa(@AuthenticationPrincipal UsuarioAutenticado ua, @PathVariable Long id, @RequestBody @Validated TarefaEntrada e) {
        return tarefas.save(aplicar(ua, minhaTarefa(ua, id), e));
    }

    @PatchMapping("/tarefas/{id}/status")
    public Tarefa mudarStatus(@AuthenticationPrincipal UsuarioAutenticado ua, @PathVariable Long id, @RequestBody @Validated StatusEntrada e) {
        Tarefa t = minhaTarefa(ua, id);
        t.mudarStatus(e.status());
        return tarefas.save(t);
    }

    @DeleteMapping("/tarefas/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void excluirTarefa(@AuthenticationPrincipal UsuarioAutenticado ua, @PathVariable Long id) {
        tarefas.delete(minhaTarefa(ua, id));   // sessao_foco.tarefa_id -> NULL: o tempo trabalhado sobrevive (RN03)
    }

    // ---------- apoio ----------

    private Lista minhaLista(UsuarioAutenticado ua, Long id) {
        return listas.findByIdAndUsuarioId(id, ua.id()).orElseThrow(() -> new NaoEncontrado("Lista"));
    }

    private Tarefa minhaTarefa(UsuarioAutenticado ua, Long id) {
        return tarefas.doUsuario(id, ua.id()).orElseThrow(() -> new NaoEncontrado("Tarefa"));
    }

    private Tarefa aplicar(UsuarioAutenticado ua, Tarefa t, TarefaEntrada e) {
        t.titulo = e.titulo().trim();
        t.descricao = e.descricao() == null || e.descricao().isBlank() ? null : e.descricao().trim();
        t.prioridade = e.prioridade() == null ? Prioridade.MEDIA : e.prioridade();
        t.prazo = e.prazo();
        t.horasEstimadas = e.horasEstimadas();
        if (e.listaId() != null && !e.listaId().equals(t.listaId)) t.listaId = minhaLista(ua, e.listaId()).id;
        t.mudarStatus(e.status() == null ? t.status : e.status());
        return t;
    }
}
