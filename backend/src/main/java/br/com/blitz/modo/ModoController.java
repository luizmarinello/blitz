package br.com.blitz.modo;

import br.com.blitz.auth.UsuarioAutenticado;
import br.com.blitz.comum.NaoEncontrado;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/** Pendência nº 1 da Sprint 4: CRUD de Modos de Foco. UC05, RF12, RF13. */
@RestController
@RequestMapping("/api/modos")
public class ModoController {
    private final ModoRepository repo;
    ModoController(ModoRepository repo) { this.repo = repo; }

    public record Entrada(
        @NotBlank(message = "Dê um nome ao modo.") @Size(max = 80) String nome,
        @Size(max = 500) String descricao,
        @Min(value = 1, message = "Foco entre 1 e 240 minutos.") @Max(value = 240, message = "Foco entre 1 e 240 minutos.") int cicloFocoMin,
        @Min(value = 0, message = "Pausa entre 0 e 120 minutos.") @Max(value = 120, message = "Pausa entre 0 e 120 minutos.") int cicloPausaMin) {}

    @GetMapping
    public List<ModoConcentracao> listar(@AuthenticationPrincipal UsuarioAutenticado ua) { return repo.visiveisPara(ua.id()); }

    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public ModoConcentracao criar(@AuthenticationPrincipal UsuarioAutenticado ua, @RequestBody @Validated Entrada e) {
        ModoConcentracao m = new ModoConcentracao();
        m.usuarioId = ua.id();
        m.predefinido = false;
        return repo.save(aplicar(m, e));
    }

    @PutMapping("/{id}")
    public ModoConcentracao editar(@AuthenticationPrincipal UsuarioAutenticado ua, @PathVariable Long id, @RequestBody @Validated Entrada e) {
        ModoConcentracao m = repo.findByIdAndUsuarioId(id, ua.id()).orElseThrow(() -> new NaoEncontrado("Modo"));
        return repo.save(aplicar(m, e));
    }

    @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void excluir(@AuthenticationPrincipal UsuarioAutenticado ua, @PathVariable Long id) {
        ModoConcentracao m = repo.findByIdAndUsuarioId(id, ua.id()).orElseThrow(() -> new NaoEncontrado("Modo"));
        try {
            repo.delete(m);
            repo.flush();   // força o erro de FK aqui (ON DELETE RESTRICT em sessao_foco) para dar mensagem clara
        } catch (DataIntegrityViolationException ex) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "Este modo já foi usado em sessões de foco e não pode ser excluído, senão o histórico perderia o significado.");
        }
    }

    private static ModoConcentracao aplicar(ModoConcentracao m, Entrada e) {
        m.nome = e.nome().trim();
        m.descricao = e.descricao() == null || e.descricao().isBlank() ? null : e.descricao().trim();
        m.cicloFocoMin = (short) e.cicloFocoMin();
        m.cicloPausaMin = (short) e.cicloPausaMin();
        return m;
    }
}
