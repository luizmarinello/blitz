package br.com.blitz;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.io.IOException;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/**
 * Único teste do projeto (ponytail): percorre o fluxo principal de ponta a ponta contra um PostgreSQL real embutido,
 * validando o schema S3 (Flyway), as restrições do banco e as regras de negócio. Cobre UC01, UC02, UC03, UC04, UC05, UC11, UC12.
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class FluxoPrincipalTest {

    static final EmbeddedPostgres PG;
    static {
        try { PG = EmbeddedPostgres.start(); } catch (IOException e) { throw new IllegalStateException(e); }
    }

    @DynamicPropertySource
    static void banco(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", () -> PG.getJdbcUrl("postgres", "postgres"));
        r.add("spring.datasource.username", () -> "postgres");
        r.add("spring.datasource.password", () -> "postgres");
        r.add("blitz.ia.api-key", () -> "");   // força o caminho alternativo (RF17)
    }

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    static final MockHttpSession SESSAO = new MockHttpSession();
    static final String EMAIL = "teste@blitz.local";
    static long listaId, tarefaId, modoId, sessaoId;

    private MvcResult chamar(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder req, int esperado) throws Exception {
        return mvc.perform(req.session(SESSAO)).andExpect(status().is(esperado)).andReturn();
    }
    private JsonNode corpo(MvcResult r) throws Exception { return json.readTree(r.getResponse().getContentAsString()); }
    private static String j(String s) { return s.replace('\'', '"'); }

    @Test @Order(1) void semLoginRetorna401() throws Exception {
        chamar(get("/api/tarefas"), 401);
    }

    @Test @Order(2) void cadastroExigeAceite() throws Exception {
        chamar(post("/api/auth/cadastro").contentType(MediaType.APPLICATION_JSON)
            .content(j("{'nome':'Teste','email':'" + EMAIL + "','senha':'senha12345','aceitaTermos':false}")), 400);
    }

    @Test @Order(3) void cadastroGravaConsentimentoEListaPadrao() throws Exception {
        chamar(post("/api/auth/cadastro").contentType(MediaType.APPLICATION_JSON)
            .content(j("{'nome':'Teste','email':'" + EMAIL + "','senha':'senha12345','aceitaTermos':true}")), 201);
        mvc.perform(get("/api/auth/me").session(SESSAO)).andExpect(status().isOk()).andExpect(jsonPath("$.email").value(EMAIL));
        mvc.perform(get("/api/privacidade/consentimentos").session(SESSAO))
            .andExpect(jsonPath("$[0].versaoPolitica").value("1.0"))
            .andExpect(jsonPath("$[0].aceitoEm").exists());
        JsonNode listas = corpo(chamar(get("/api/listas"), 200));
        listaId = listas.get(0).get("id").asLong();
    }

    @Test @Order(4) void tarefaRespeitaRestricaoDeConclusao() throws Exception {
        JsonNode t = corpo(chamar(post("/api/listas/" + listaId + "/tarefas").contentType(MediaType.APPLICATION_JSON)
            .content(j("{'titulo':'Escrever relatório','prioridade':'ALTA','prazo':'2026-12-01','horasEstimadas':2.5}")), 201));
        tarefaId = t.get("id").asLong();

        mvc.perform(patch("/api/tarefas/" + tarefaId + "/status").session(SESSAO).contentType(MediaType.APPLICATION_JSON).content(j("{'status':'CONCLUIDA'}")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.concluidaEm").exists());
        mvc.perform(patch("/api/tarefas/" + tarefaId + "/status").session(SESSAO).contentType(MediaType.APPLICATION_JSON).content(j("{'status':'EM_ANDAMENTO'}")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.concluidaEm").doesNotExist());
        chamar(post("/api/listas/" + listaId + "/tarefas").contentType(MediaType.APPLICATION_JSON).content(j("{'titulo':'','horasEstimadas':-1}")), 400);
    }

    @Test @Order(5) void modosPredefinidosEPersonalizado() throws Exception {
        JsonNode modos = corpo(chamar(get("/api/modos"), 200));
        org.assertj.core.api.Assertions.assertThat(modos.size()).isEqualTo(3);
        JsonNode m = corpo(chamar(post("/api/modos").contentType(MediaType.APPLICATION_JSON)
            .content(j("{'nome':'Meu modo','cicloFocoMin':30,'cicloPausaMin':5}")), 201));
        modoId = m.get("id").asLong();
        chamar(post("/api/modos").contentType(MediaType.APPLICATION_JSON).content(j("{'nome':'x','cicloFocoMin':241,'cicloPausaMin':5}")), 400);
        chamar(put("/api/modos/" + modos.get(0).get("id").asLong()).contentType(MediaType.APPLICATION_JSON)
            .content(j("{'nome':'Hack','cicloFocoMin':1,'cicloPausaMin':1}")), 404);   // predefinido não é editável
    }

    @Test @Order(6) void sessaoDeFocoGeraMetricaEProtegeModo() throws Exception {
        JsonNode s = corpo(chamar(post("/api/sessoes").contentType(MediaType.APPLICATION_JSON)
            .content("{\"modoId\":" + modoId + ",\"tarefaId\":" + tarefaId + "}"), 201));
        sessaoId = s.get("id").asLong();
        chamar(post("/api/sessoes").contentType(MediaType.APPLICATION_JSON).content("{\"modoId\":" + modoId + "}"), 409);
        mvc.perform(post("/api/sessoes/" + sessaoId + "/encerrar").session(SESSAO).contentType(MediaType.APPLICATION_JSON).content(j("{'segundosAtivos':5}")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.duracaoSegundos").value(lessThanOrEqualTo(5)));
        chamar(delete("/api/modos/" + modoId), 409);                       // ON DELETE RESTRICT
        chamar(delete("/api/tarefas/" + tarefaId), 204);                   // ON DELETE SET NULL
        mvc.perform(get("/api/metricas").session(SESSAO)).andExpect(jsonPath("$.totalSessoes").value(1));
        mvc.perform(get("/api/sessoes").session(SESSAO)).andExpect(jsonPath("$[0].tarefaId").doesNotExist());
    }

    @Test @Order(7) void iaSemChaveRespondeComAlternativa() throws Exception {
        mvc.perform(post("/api/ia/mensagem").session(SESSAO).contentType(MediaType.APPLICATION_JSON).content(j("{'mensagem':'O que fazer agora?'}")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.fallback").value(true))
            .andExpect(jsonPath("$.resposta", containsString("indisponível")));
        mvc.perform(get("/api/ia/limite").session(SESSAO)).andExpect(jsonPath("$.maximo").value(20000));
    }

    @Test @Order(8) void acessibilidadeEExportacao() throws Exception {
        mvc.perform(put("/api/acessibilidade").session(SESSAO).contentType(MediaType.APPLICATION_JSON)
            .content(j("{'tema':'ALTO_CONTRASTE','tamanhoFonte':'GRANDE','reduzirAnimacoes':true,'leitorTela':false}")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.tema").value("ALTO_CONTRASTE"));
        mvc.perform(get("/api/privacidade/exportar").session(SESSAO)).andExpect(status().isOk()).andExpect(jsonPath("$.sessoesFoco").isArray());
        mvc.perform(get("/api/privacidade/exportar.csv").session(SESSAO)).andExpect(status().isOk())
            .andExpect(content().string(containsString("titulo")));
    }

    @Autowired br.com.blitz.auth.RecuperacaoSenhaService recuperacao;
    @Autowired br.com.blitz.usuario.UsuarioRepository usuarios;

    @Test @Order(9) void recuperacaoDeSenhaComTokenAssinado() throws Exception {
        // pedido: mesma resposta para e-mail existente e inexistente (não revela contas)
        mvc.perform(post("/api/auth/recuperar").contentType(MediaType.APPLICATION_JSON).content(j("{'email':'" + EMAIL + "'}")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.mensagem", containsString("Se existir")));
        mvc.perform(post("/api/auth/recuperar").contentType(MediaType.APPLICATION_JSON).content(j("{'email':'ninguem@blitz.local'}")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.mensagem", containsString("Se existir")));

        var u = usuarios.findByEmailIgnoreCase(EMAIL).orElseThrow();
        String token = recuperacao.gerarToken(u);
        chamar(post("/api/auth/redefinir").contentType(MediaType.APPLICATION_JSON).content(j("{'token':'x.y.z','novaSenha':'outrasenha123'}")), 400);
        chamar(post("/api/auth/redefinir").contentType(MediaType.APPLICATION_JSON).content(j("{'token':'" + token + "','novaSenha':'curta'}")), 400);
        chamar(post("/api/auth/redefinir").contentType(MediaType.APPLICATION_JSON).content(j("{'token':'" + token + "','novaSenha':'outrasenha123'}")), 200);
        // uso único: depois da troca o mesmo token não vale mais
        chamar(post("/api/auth/redefinir").contentType(MediaType.APPLICATION_JSON).content(j("{'token':'" + token + "','novaSenha':'terceira123'}")), 400);
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
            .content(j("{'email':'" + EMAIL + "','senha':'outrasenha123'}"))).andExpect(status().isOk());
    }

    @Test @Order(10) void exclusaoAnonimizaEImpedeLogin() throws Exception {
        chamar(delete("/api/privacidade/conta").contentType(MediaType.APPLICATION_JSON).content(j("{'senha':'errada'}")), 401);
        chamar(delete("/api/privacidade/conta").contentType(MediaType.APPLICATION_JSON).content(j("{'senha':'outrasenha123'}")), 200);
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
            .content(j("{'email':'" + EMAIL + "','senha':'outrasenha123'}"))).andExpect(status().isUnauthorized());
    }
}
