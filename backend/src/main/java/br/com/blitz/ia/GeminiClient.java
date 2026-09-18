package br.com.blitz.ia;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * Única porta de saída para o provedor de IA (regra de arquitetura: a credencial nunca vai ao cliente).
 * O que sai daqui é só o que o IaController monta: títulos, prioridade, prazo, horas. Nunca nome, e-mail ou id (RNF-LGPD07).
 */
@Component
public class GeminiClient {
    public record Turno(String papel, String texto) {}          // papel: "user" | "model"
    public record Resposta(String texto, int tokens) {}

    private final RestClient http;
    private final String apiKey;
    private final String modelo;

    GeminiClient(RestTemplateBuilder builder,
                 @Value("${blitz.ia.api-key}") String apiKey,
                 @Value("${blitz.ia.modelo}") String modelo) {
        this.http = RestClient.create(builder.connectTimeout(Duration.ofSeconds(5)).readTimeout(Duration.ofSeconds(20)).build());
        this.apiKey = apiKey;
        this.modelo = modelo;
    }

    public boolean configurado() { return apiKey != null && !apiKey.isBlank(); }

    @SuppressWarnings("unchecked")
    public Resposta gerar(String instrucaoSistema, List<Turno> historico, String mensagem) {
        if (!configurado()) throw new IllegalStateException("GEMINI_API_KEY ausente");

        List<Map<String, Object>> contents = new ArrayList<>();
        for (Turno t : historico) contents.add(Map.of("role", t.papel(), "parts", List.of(Map.of("text", t.texto()))));
        contents.add(Map.of("role", "user", "parts", List.of(Map.of("text", mensagem))));

        Map<String, Object> corpo = Map.of(
            "system_instruction", Map.of("parts", List.of(Map.of("text", instrucaoSistema))),
            "contents", contents,
            "generationConfig", Map.of("temperature", 0.4, "maxOutputTokens", 700));

        Map<String, Object> r = http.post()
            .uri("https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent", modelo)
            .header("x-goog-api-key", apiKey)
            .header("Content-Type", "application/json")
            .body(corpo)
            .retrieve()
            .body(Map.class);

        List<Map<String, Object>> candidatos = (List<Map<String, Object>>) r.get("candidates");
        Map<String, Object> content = (Map<String, Object>) candidatos.get(0).get("content");
        List<Map<String, Object>> parts = (List<Map<String, Object>>) content.get("parts");
        StringBuilder texto = new StringBuilder();
        for (Map<String, Object> p : parts) if (p.get("text") != null) texto.append(p.get("text"));

        Map<String, Object> uso = (Map<String, Object>) r.get("usageMetadata");
        int tokens = uso == null || uso.get("totalTokenCount") == null ? 0 : ((Number) uso.get("totalTokenCount")).intValue();
        return new Resposta(texto.toString().trim(), tokens);
    }
}
