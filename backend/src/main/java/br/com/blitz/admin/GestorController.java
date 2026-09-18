package br.com.blitz.admin;

import br.com.blitz.auth.UsuarioAutenticado;
import br.com.blitz.usuario.Usuario;
import br.com.blitz.usuario.UsuarioRepository;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** RF21: gestor vê só a própria equipe. Só agregados, pela view (equipes com menos de 5 pessoas não aparecem). */
@RestController
@RequestMapping("/api/gestor")
public class GestorController {
    private final UsuarioRepository usuarios;
    private final OrganizacaoRepository organizacoes;
    private final JdbcTemplate jdbc;

    GestorController(UsuarioRepository usuarios, OrganizacaoRepository organizacoes, JdbcTemplate jdbc) {
        this.usuarios = usuarios; this.organizacoes = organizacoes; this.jdbc = jdbc;
    }

    @GetMapping("/metricas")
    public Map<String, Object> metricas(@AuthenticationPrincipal UsuarioAutenticado ua) {
        Usuario u = usuarios.findById(ua.id()).orElseThrow();
        Map<String, Object> m = new LinkedHashMap<>();
        if (u.organizacaoId == null) { m.put("semOrganizacao", true); return m; }
        m.put("organizacao", organizacoes.findById(u.organizacaoId).map(o -> o.nome).orElse("?"));
        m.put("colaboradores", jdbc.queryForObject("select count(*) from usuario where organizacao_id = ? and ativo", Long.class, u.organizacaoId));
        List<Map<String, Object>> linhas = jdbc.queryForList("select * from vw_metricas_organizacao where organizacao_id = ?", u.organizacaoId);
        m.put("metricas", linhas.isEmpty() ? null : linhas.get(0));   // null = equipe pequena demais para exibir (reidentificação)
        return m;
    }
}
