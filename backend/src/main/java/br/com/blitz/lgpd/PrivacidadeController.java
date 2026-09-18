package br.com.blitz.lgpd;

import br.com.blitz.acessibilidade.PreferenciaRepository;
import br.com.blitz.auth.UsuarioAutenticado;
import br.com.blitz.ia.ConversaRepository;
import br.com.blitz.modo.ModoConcentracao;
import br.com.blitz.modo.ModoRepository;
import br.com.blitz.sessao.SessaoRepository;
import br.com.blitz.tarefa.ListaRepository;
import br.com.blitz.tarefa.Tarefa;
import br.com.blitz.tarefa.TarefaRepository;
import br.com.blitz.usuario.Usuario;
import br.com.blitz.usuario.UsuarioRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.NotBlank;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/** UC11 Gerenciar Consentimento e Dados Pessoais. RF-LGPD02 (finalidade), RF-LGPD03 (acesso/exportação), RF-LGPD04 (exclusão), RN07. */
@RestController
@RequestMapping("/api/privacidade")
public class PrivacidadeController {
    private final UsuarioRepository usuarios;
    private final ConsentimentoRepository consentimentos;
    private final PreferenciaRepository preferencias;
    private final ListaRepository listas;
    private final TarefaRepository tarefas;
    private final SessaoRepository sessoes;
    private final ModoRepository modos;
    private final ConversaRepository conversas;
    private final PasswordEncoder encoder;

    PrivacidadeController(UsuarioRepository usuarios, ConsentimentoRepository consentimentos, PreferenciaRepository preferencias,
                          ListaRepository listas, TarefaRepository tarefas, SessaoRepository sessoes, ModoRepository modos,
                          ConversaRepository conversas, PasswordEncoder encoder) {
        this.usuarios = usuarios; this.consentimentos = consentimentos; this.preferencias = preferencias; this.listas = listas;
        this.tarefas = tarefas; this.sessoes = sessoes; this.modos = modos; this.conversas = conversas; this.encoder = encoder;
    }

    public record Confirmacao(@NotBlank(message = "Confirme sua senha.") String senha) {}

    @GetMapping("/consentimentos")
    public List<Consentimento> consentimentos(@AuthenticationPrincipal UsuarioAutenticado ua) {
        return consentimentos.findByUsuarioIdOrderByAceitoEmDesc(ua.id());
    }

    /** RF-LGPD03: cópia completa e legível por máquina de tudo que o Blitz guarda sobre o titular. */
    @GetMapping(value = "/exportar", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> exportarJson(@AuthenticationPrincipal UsuarioAutenticado ua) {
        Usuario u = usuarios.findById(ua.id()).orElseThrow();
        Map<String, Object> dados = new LinkedHashMap<>();
        dados.put("geradoEm", Instant.now().toString());
        dados.put("usuario", Map.of("nome", u.nome, "email", u.email, "papel", u.papel, "criadoEm", u.criadoEm));
        dados.put("consentimentos", consentimentos.findByUsuarioIdOrderByAceitoEmDesc(u.id));
        preferencias.findById(u.id).ifPresent(p -> dados.put("preferenciasAcessibilidade", p));
        dados.put("listas", listas.findByUsuarioIdOrderByPosicaoAscIdAsc(u.id));
        dados.put("tarefas", tarefas.todasDoUsuario(u.id));
        dados.put("modosPersonalizados", modos.findByUsuarioId(u.id));
        dados.put("sessoesFoco", sessoes.findByUsuarioIdOrderByInicioDesc(u.id));
        dados.put("conversasIa", conversas.findByUsuarioIdOrderByDataHoraAsc(u.id));
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=blitz-meus-dados.json")
            .body(dados);
    }

    /** US-08 / RF-LGPD03: tarefas em CSV (separador ';' e BOM para abrir direto no Excel em pt-BR). */
    @GetMapping(value = "/exportar.csv", produces = "text/csv")
    public ResponseEntity<byte[]> exportarCsv(@AuthenticationPrincipal UsuarioAutenticado ua) {
        Map<Long, String> nomesListas = new LinkedHashMap<>();
        listas.findByUsuarioIdOrderByPosicaoAscIdAsc(ua.id()).forEach(l -> nomesListas.put(l.id, l.nome));
        StringBuilder sb = new StringBuilder("﻿");
        sb.append("lista;titulo;descricao;prioridade;status;prazo;horas_estimadas;criada_em;concluida_em\n");
        for (Tarefa t : tarefas.todasDoUsuario(ua.id())) {
            sb.append(csv(nomesListas.get(t.listaId))).append(';')
              .append(csv(t.titulo)).append(';')
              .append(csv(t.descricao)).append(';')
              .append(t.prioridade).append(';')
              .append(t.status).append(';')
              .append(t.prazo == null ? "" : t.prazo).append(';')
              .append(t.horasEstimadas == null ? "" : t.horasEstimadas.toPlainString().replace('.', ',')).append(';')
              .append(t.criadoEm).append(';')
              .append(t.concluidaEm == null ? "" : t.concluidaEm).append('\n');
        }
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=blitz-tarefas.csv")
            .contentType(MediaType.parseMediaType("text/csv;charset=UTF-8"))
            .body(sb.toString().getBytes(StandardCharsets.UTF_8));
    }

    private static String csv(String v) {
        if (v == null) return "";
        boolean precisa = v.contains(";") || v.contains("\"") || v.contains("\n");
        return precisa ? "\"" + v.replace("\"", "\"\"") + "\"" : v;
    }

    /**
     * RF-LGPD04: exclusão por anonimização. Apaga o que identifica (nome, e-mail, senha, tarefas, listas, conversas) e
     * mantém sessões desvinculadas para métricas agregadas (RN03) e o histórico de consentimento como prova do aceite.
     * Único caminho sem retorno do app: encerra a sessão.
     */
    @DeleteMapping("/conta")
    @Transactional
    public Map<String, String> excluirConta(@AuthenticationPrincipal UsuarioAutenticado ua, @RequestBody @Validated Confirmacao c, HttpServletRequest req) {
        Usuario u = usuarios.findById(ua.id()).orElseThrow();
        if (!encoder.matches(c.senha(), u.senhaHash))
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Senha incorreta.");

        conversas.deleteByUsuarioId(u.id);
        listas.deleteByUsuarioId(u.id);              // tarefas em cascata; sessao_foco.tarefa_id vira NULL
        for (ModoConcentracao m : modos.findByUsuarioId(u.id)) { m.nome = "Modo removido"; m.descricao = null; modos.save(m); }
        preferencias.deleteById(u.id);

        u.nome = "Usuário removido";
        u.email = "removido-" + u.id + "@anonimo.blitz.invalid";
        u.senhaHash = encoder.encode(UUID.randomUUID().toString());
        u.ativo = false;
        u.anonimizadoEm = Instant.now();
        usuarios.save(u);

        if (req.getSession(false) != null) req.getSession(false).invalidate();
        SecurityContextHolder.clearContext();
        return Map.of("mensagem", "Sua conta foi encerrada e seus dados pessoais foram anonimizados.");
    }
}
