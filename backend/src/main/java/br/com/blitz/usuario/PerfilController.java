package br.com.blitz.usuario;

import br.com.blitz.auth.AuthController;
import br.com.blitz.auth.UsuarioAutenticado;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/** Tela 11 Perfil e preferências. RF-LGPD03 (corrigir dados), RN07. */
@RestController
@RequestMapping("/api/perfil")
public class PerfilController {
    private final UsuarioRepository usuarios;
    private final PasswordEncoder encoder;
    PerfilController(UsuarioRepository usuarios, PasswordEncoder encoder) { this.usuarios = usuarios; this.encoder = encoder; }

    public record Nome(@NotBlank(message = "Informe seu nome.") @Size(max = 180) String nome) {}
    public record Senha(@NotBlank(message = "Informe a senha atual.") String atual,
                        @NotBlank(message = "Informe a nova senha.") @Size(min = 8, max = 72, message = "A senha precisa ter entre 8 e 72 caracteres.") String nova) {}

    @PutMapping
    public Map<String, Object> renomear(@AuthenticationPrincipal UsuarioAutenticado ua, @RequestBody @Validated Nome n) {
        Usuario u = usuarios.findById(ua.id()).orElseThrow();
        u.nome = n.nome().trim();
        return AuthController.resumo(usuarios.save(u));
    }

    @PutMapping("/senha")
    public void trocarSenha(@AuthenticationPrincipal UsuarioAutenticado ua, @RequestBody @Validated Senha s) {
        Usuario u = usuarios.findById(ua.id()).orElseThrow();
        if (!encoder.matches(s.atual(), u.senhaHash)) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Senha atual incorreta.");
        u.senhaHash = encoder.encode(s.nova());
        usuarios.save(u);
    }
}
