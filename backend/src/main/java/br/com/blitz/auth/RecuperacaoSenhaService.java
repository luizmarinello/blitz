package br.com.blitz.auth;

import br.com.blitz.usuario.Usuario;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

/**
 * RF03 Recuperação de senha, sem tabela de tokens: o token é "id.expira.hmac", onde o HMAC cobre id, validade e o
 * hash atual da senha. Expira em 1 hora e deixa de valer assim que a senha muda (uso único por construção).
 * ponytail: sem limite de pedidos por e-mail; adicionar se aparecer abuso.
 */
@Service
public class RecuperacaoSenhaService {
    private static final Logger log = LoggerFactory.getLogger(RecuperacaoSenhaService.class);
    private static final long VALIDADE_SEGUNDOS = 3600;

    private final byte[] segredo;
    private final String urlApp;
    private final String remetente;
    private final String smtpHost;
    private final ObjectProvider<JavaMailSender> mail;

    RecuperacaoSenhaService(@Value("${blitz.segredo}") String segredo,
                            @Value("${blitz.url}") String urlApp,
                            @Value("${blitz.email-remetente}") String remetente,
                            @Value("${spring.mail.host:}") String smtpHost,
                            ObjectProvider<JavaMailSender> mail) {
        if (segredo == null || segredo.isBlank()) {
            byte[] aleatorio = new byte[32];
            new SecureRandom().nextBytes(aleatorio);
            this.segredo = aleatorio;   // sem APP_SECRET: links deixam de valer a cada reinício (ok em desenvolvimento)
            log.warn("APP_SECRET nao definido: tokens de recuperacao de senha valem so ate o proximo reinicio.");
        } else {
            this.segredo = segredo.getBytes(StandardCharsets.UTF_8);
        }
        this.urlApp = urlApp.replaceAll("/+$", "");
        this.remetente = remetente;
        this.smtpHost = smtpHost;
        this.mail = mail;
    }

    public String gerarToken(Usuario u) {
        long expira = Instant.now().getEpochSecond() + VALIDADE_SEGUNDOS;
        String base = u.id + "." + expira;
        return base + "." + assinar(base, u.senhaHash);
    }

    /** Retorna o id do usuário se o token for válido para o hash de senha informado. */
    public Optional<Long> validar(String token, java.util.function.Function<Long, Optional<Usuario>> buscar) {
        try {
            String[] p = token.split("\\.");
            if (p.length != 3) return Optional.empty();
            long id = Long.parseLong(p[0]);
            long expira = Long.parseLong(p[1]);
            if (Instant.now().getEpochSecond() > expira) return Optional.empty();
            Optional<Usuario> u = buscar.apply(id);
            if (u.isEmpty() || !u.get().ativo) return Optional.empty();
            String esperado = assinar(p[0] + "." + p[1], u.get().senhaHash);
            boolean ok = MessageDigest.isEqual(esperado.getBytes(StandardCharsets.UTF_8), p[2].getBytes(StandardCharsets.UTF_8));
            return ok ? Optional.of(id) : Optional.empty();
        } catch (RuntimeException e) {
            return Optional.empty();
        }
    }

    public void enviarLink(Usuario u) {
        String link = urlApp + "/#/redefinir?token=" + gerarToken(u);
        JavaMailSender sender = mail.getIfAvailable();
        if (smtpHost == null || smtpHost.isBlank() || sender == null) {
            // Sem SMTP configurado: modo desenvolvimento. Nunca deixar assim em produção.
            log.warn("SMTP nao configurado. Link de redefinicao para o usuario {}: {}", pseudonimo(u.id), link);
            return;
        }
        SimpleMailMessage m = new SimpleMailMessage();
        m.setFrom(remetente);
        m.setTo(u.email);
        m.setSubject("Blitz: redefinir sua senha");
        m.setText("Olá, " + u.nome.split(" ")[0] + ".\n\n"
            + "Recebemos um pedido para redefinir a senha da sua conta no Blitz. Use o link abaixo em até 1 hora:\n\n"
            + link + "\n\n"
            + "Se você não pediu isso, ignore esta mensagem: sua senha continua a mesma.\n\n— Equipe Blitz");
        sender.send(m);
        log.info("E-mail de redefinicao enviado para o usuario {}", pseudonimo(u.id));
    }

    private String assinar(String base, String senhaHash) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(segredo, "HmacSHA256"));
            byte[] h = mac.doFinal((base + "." + senhaHash).getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(h);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private String pseudonimo(Long id) {
        try {
            byte[] h = MessageDigest.getInstance("SHA-256").digest(("rec:" + id).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(h, 0, 6);
        } catch (Exception e) { return "?"; }
    }
}
