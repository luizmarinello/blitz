package br.com.blitz.admin;

import br.com.blitz.auth.UsuarioAutenticado;
import br.com.blitz.comum.NaoEncontrado;
import br.com.blitz.ia.GeminiClient;
import br.com.blitz.usuario.Papel;
import br.com.blitz.usuario.Usuario;
import br.com.blitz.usuario.UsuarioRepository;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/**
 * Painel administrativo (pendência nº 11). UC06 usuários, UC08 métricas, UC10 integrações; RF18–RF20, RN04.
 * Acesso: só ADMINISTRADOR (SecurityConfig). Métricas por organização vêm da view vw_metricas_organizacao,
 * que já suprime equipes com menos de 5 pessoas (proteção fica no banco, de propósito).
 * UC07 (conteúdos) e UC09 (funcionalidades) não têm tela prototipada nem requisito detalhado: ficam de fora até serem especificados.
 */
@RestController
@RequestMapping("/api/admin")
public class AdminController {
    private final UsuarioRepository usuarios;
    private final OrganizacaoRepository organizacoes;
    private final JdbcTemplate jdbc;
    private final GeminiClient gemini;
    private final String modeloIa;
    private final long limiteTokensDia;
    private final String smtpHost;

    AdminController(UsuarioRepository usuarios, OrganizacaoRepository organizacoes, JdbcTemplate jdbc, GeminiClient gemini,
                    @Value("${blitz.ia.modelo}") String modeloIa, @Value("${blitz.ia.limite-tokens-dia}") long limiteTokensDia,
                    @Value("${spring.mail.host:}") String smtpHost) {
        this.usuarios = usuarios; this.organizacoes = organizacoes; this.jdbc = jdbc; this.gemini = gemini;
        this.modeloIa = modeloIa; this.limiteTokensDia = limiteTokensDia; this.smtpHost = smtpHost;
    }

    public record UsuarioPatch(Papel papel, Boolean ativo, Long organizacaoId, boolean limparOrganizacao) {}
    public record OrganizacaoEntrada(@NotBlank(message = "Informe o nome.") @Size(max = 180) String nome,
                                     @Min(value = 0, message = "Licenças não podem ser negativas.") int licencasTotais) {}

    // ---------- UC06 usuários ----------

    @GetMapping("/usuarios")
    public List<Usuario> usuarios() { return usuarios.findAll(org.springframework.data.domain.Sort.by("id")); }

    @PatchMapping("/usuarios/{id}")
    public Usuario alterarUsuario(@AuthenticationPrincipal UsuarioAutenticado ua, @PathVariable Long id, @RequestBody UsuarioPatch p) {
        Usuario u = usuarios.findById(id).orElseThrow(() -> new NaoEncontrado("Usuário"));
        if (u.id.equals(ua.id()) && (p.papel() != null || p.ativo() != null))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Você não pode alterar o próprio papel ou desativar a própria conta.");
        if (u.anonimizadoEm != null)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Conta anonimizada não pode ser alterada.");
        if (p.papel() != null) u.papel = p.papel();
        if (p.ativo() != null) u.ativo = p.ativo();
        if (p.limparOrganizacao()) u.organizacaoId = null;
        else if (p.organizacaoId() != null) u.organizacaoId = organizacoes.findById(p.organizacaoId()).orElseThrow(() -> new NaoEncontrado("Organização")).id;
        return usuarios.save(u);
    }

    // ---------- organizações (B2B) ----------

    @GetMapping("/organizacoes")
    public List<Organizacao> organizacoes() { return organizacoes.findAll(org.springframework.data.domain.Sort.by("nome")); }

    @PostMapping("/organizacoes") @ResponseStatus(HttpStatus.CREATED)
    public Organizacao criarOrganizacao(@RequestBody @Validated OrganizacaoEntrada e) {
        Organizacao o = new Organizacao();
        o.nome = e.nome().trim();
        o.licencasTotais = e.licencasTotais();
        return organizacoes.save(o);
    }

    @PutMapping("/organizacoes/{id}")
    public Organizacao editarOrganizacao(@PathVariable Long id, @RequestBody @Validated OrganizacaoEntrada e) {
        Organizacao o = organizacoes.findById(id).orElseThrow(() -> new NaoEncontrado("Organização"));
        o.nome = e.nome().trim();
        o.licencasTotais = e.licencasTotais();
        return organizacoes.save(o);
    }

    // ---------- UC08 métricas ----------

    @GetMapping("/metricas")
    public Map<String, Object> metricas() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("usuarios", jdbc.queryForObject("select count(*) from usuario where anonimizado_em is null", Long.class));
        m.put("usuariosAtivos", jdbc.queryForObject("select count(*) from usuario where ativo and anonimizado_em is null", Long.class));
        m.put("usuariosAnonimizados", jdbc.queryForObject("select count(*) from usuario where anonimizado_em is not null", Long.class));
        m.put("sessoes", jdbc.queryForObject("select count(*) from sessao_foco where fim is not null", Long.class));
        m.put("minutosFoco", jdbc.queryForObject("select coalesce(sum(duracao_segundos),0)/60 from sessao_foco where fim is not null", Long.class));
        m.put("tarefas", jdbc.queryForObject("select count(*) from tarefa", Long.class));
        m.put("tarefasConcluidas", jdbc.queryForObject("select count(*) from tarefa where status = 'CONCLUIDA'", Long.class));
        m.put("conversasIa30Dias", jdbc.queryForObject("select count(*) from conversa_ia where data_hora >= now() - interval '30 days'", Long.class));
        m.put("tokensIa30Dias", jdbc.queryForObject("select coalesce(sum(tokens_usados),0) from conversa_ia where data_hora >= now() - interval '30 days'", Long.class));
        m.put("organizacoes", jdbc.queryForList("select * from vw_metricas_organizacao order by organizacao"));
        return m;
    }

    // ---------- UC10 integrações (status; a configuração é por variável de ambiente) ----------

    @GetMapping("/integracoes")
    public Map<String, Object> integracoes() {
        return Map.of(
            "ia", Map.of("provedor", "Google Gemini", "modelo", modeloIa, "configurado", gemini.configurado(), "limiteTokensDia", limiteTokensDia),
            "email", Map.of("provedor", "SMTP", "configurado", smtpHost != null && !smtpHost.isBlank(), "host", smtpHost == null ? "" : smtpHost));
    }
}
