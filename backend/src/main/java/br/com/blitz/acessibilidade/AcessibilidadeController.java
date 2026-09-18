package br.com.blitz.acessibilidade;

import br.com.blitz.auth.UsuarioAutenticado;
import jakarta.validation.constraints.NotNull;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

/** UC12 Configurar Acessibilidade. Preferências valem em todas as telas (RN08): o front aplica no <html>. */
@RestController
@RequestMapping("/api/acessibilidade")
public class AcessibilidadeController {
    private final PreferenciaRepository repo;
    AcessibilidadeController(PreferenciaRepository repo) { this.repo = repo; }

    public record Entrada(@NotNull Tema tema, @NotNull TamanhoFonte tamanhoFonte, boolean reduzirAnimacoes, boolean leitorTela) {}

    @GetMapping
    public PreferenciaAcessibilidade obter(@AuthenticationPrincipal UsuarioAutenticado ua) {
        return repo.findById(ua.id()).orElseGet(() -> {
            var p = new PreferenciaAcessibilidade();
            p.usuarioId = ua.id();
            return repo.save(p);
        });
    }

    @PutMapping
    public PreferenciaAcessibilidade salvar(@AuthenticationPrincipal UsuarioAutenticado ua, @RequestBody @Validated Entrada e) {
        PreferenciaAcessibilidade p = obter(ua);
        p.tema = e.tema();
        p.tamanhoFonte = e.tamanhoFonte();
        p.reduzirAnimacoes = e.reduzirAnimacoes();
        p.leitorTela = e.leitorTela();
        return repo.save(p);
    }
}
