package br.com.blitz.ia;

import java.time.Duration;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Pendência nº 7 (achado IA-02, art. 6º III da LGPD): minimização por retenção. Depois de N dias, o conteúdo da
 * mensagem e da resposta é apagado; ficam só data/hora e tokens, que sustentam o limite de uso (RNF09).
 * Não altera o schema (mensagem continua NOT NULL, recebe uma marca). Remover a coluna exige discutir a modelagem.
 */
@Component
public class RetencaoConversas {
    public static final String MARCA = "[conteúdo apagado após o período de retenção]";
    private static final Logger log = LoggerFactory.getLogger(RetencaoConversas.class);

    private final ConversaRepository conversas;
    private final int dias;

    RetencaoConversas(ConversaRepository conversas, @Value("${blitz.ia.retencao-dias}") int dias) {
        this.conversas = conversas; this.dias = dias;
    }

    @EventListener(ApplicationReadyEvent.class)
    @Scheduled(cron = "0 30 3 * * *")   // diariamente às 03:30 no fuso do servidor
    @Transactional
    public void executar() {
        if (dias <= 0) return;
        int n = conversas.apagarConteudoAntes(Instant.now().minus(Duration.ofDays(dias)), MARCA);
        if (n > 0) log.info("Retencao de conversas: conteudo de {} registro(s) com mais de {} dias apagado.", n, dias);
    }
}
