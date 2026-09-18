package br.com.blitz.auth;

import br.com.blitz.acessibilidade.PreferenciaAcessibilidade;
import br.com.blitz.acessibilidade.PreferenciaRepository;
import br.com.blitz.lgpd.Consentimento;
import br.com.blitz.lgpd.ConsentimentoRepository;
import br.com.blitz.tarefa.Lista;
import br.com.blitz.tarefa.ListaRepository;
import br.com.blitz.usuario.Usuario;
import br.com.blitz.usuario.UsuarioRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/** UC01 Fazer Login (inclui Aceitar Termos e Política). RF01, RF02, RF04, RF-LGPD01, RNF-LGPD06. */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UsuarioRepository usuarios;
    private final ConsentimentoRepository consentimentos;
    private final PreferenciaRepository preferencias;
    private final ListaRepository listas;
    private final PasswordEncoder encoder;
    private final AuthenticationManager authManager;
    private final SecurityContextRepository contextRepo;
    private final String politicaVersao;

    AuthController(UsuarioRepository usuarios, ConsentimentoRepository consentimentos, PreferenciaRepository preferencias,
                   ListaRepository listas, PasswordEncoder encoder, AuthenticationManager authManager,
                   SecurityContextRepository contextRepo, @Value("${blitz.politica-versao}") String politicaVersao) {
        this.usuarios = usuarios; this.consentimentos = consentimentos; this.preferencias = preferencias;
        this.listas = listas; this.encoder = encoder; this.authManager = authManager;
        this.contextRepo = contextRepo; this.politicaVersao = politicaVersao;
    }

    public record Cadastro(
        @NotBlank(message = "Informe seu nome.") @Size(max = 180) String nome,
        @NotBlank(message = "Informe seu e-mail.") @Email(message = "E-mail inválido.") @Size(max = 255) String email,
        @NotBlank(message = "Informe uma senha.") @Size(min = 8, max = 72, message = "A senha precisa ter entre 8 e 72 caracteres.") String senha,
        @AssertTrue(message = "É preciso aceitar os Termos de Uso e a Política de Privacidade.") boolean aceitaTermos) {}

    public record Login(@NotBlank(message = "Informe seu e-mail.") String email, @NotBlank(message = "Informe sua senha.") String senha) {}

    @PostMapping("/cadastro")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public Map<String, Object> cadastrar(@RequestBody @Validated Cadastro c, HttpServletRequest req, HttpServletResponse res) {
        if (usuarios.existsByEmailIgnoreCase(c.email()))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Já existe uma conta com este e-mail.");

        Usuario u = new Usuario();
        u.nome = c.nome().trim();
        u.email = c.email().trim().toLowerCase();
        u.senhaHash = encoder.encode(c.senha());
        u = usuarios.save(u);

        // RF-LGPD01 / RNF-LGPD06: registro imutável do aceite, com versão, data/hora e finalidade
        Consentimento cons = new Consentimento();
        cons.usuarioId = u.id;
        cons.versaoPolitica = politicaVersao;
        cons.finalidade = "Prestação do serviço Blitz: gestão de tarefas, sessões de foco e assistente de IA. "
                        + "Base legal: execução de contrato (art. 7º, V) e consentimento (art. 7º, I) da LGPD.";
        consentimentos.save(cons);

        PreferenciaAcessibilidade pref = new PreferenciaAcessibilidade();
        pref.usuarioId = u.id;
        preferencias.save(pref);

        Lista l = new Lista();
        l.usuarioId = u.id;
        l.nome = "Minhas tarefas";
        listas.save(l);

        autenticar(u.email, c.senha(), req, res);
        return resumo(u);
    }

    @PostMapping("/login")
    public Map<String, Object> login(@RequestBody @Validated Login l, HttpServletRequest req, HttpServletResponse res) {
        UsuarioAutenticado ua = autenticar(l.email().trim().toLowerCase(), l.senha(), req, res);
        return resumo(usuarios.findById(ua.id()).orElseThrow());
    }

    @PostMapping("/logout")
    public void logout(HttpServletRequest req) {
        if (req.getSession(false) != null) req.getSession(false).invalidate();
        SecurityContextHolder.clearContext();
    }

    @GetMapping("/me")
    public Map<String, Object> me(@AuthenticationPrincipal UsuarioAutenticado ua) {
        if (ua == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Faça login para continuar.");
        return resumo(usuarios.findById(ua.id()).orElseThrow());
    }

    private UsuarioAutenticado autenticar(String email, String senha, HttpServletRequest req, HttpServletResponse res) {
        Authentication auth;
        try {
            auth = authManager.authenticate(UsernamePasswordAuthenticationToken.unauthenticated(email, senha));
        } catch (DisabledException e) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Esta conta foi encerrada.");
        } catch (BadCredentialsException e) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "E-mail ou senha incorretos.");
        }
        SecurityContext ctx = SecurityContextHolder.createEmptyContext();
        ctx.setAuthentication(auth);
        SecurityContextHolder.setContext(ctx);
        contextRepo.saveContext(ctx, req, res);
        return (UsuarioAutenticado) auth.getPrincipal();
    }

    public static Map<String, Object> resumo(Usuario u) {
        return Map.of("id", u.id, "nome", u.nome, "email", u.email, "papel", u.papel.name());
    }
}
