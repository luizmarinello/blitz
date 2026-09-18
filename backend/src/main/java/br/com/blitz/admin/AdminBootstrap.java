package br.com.blitz.admin;

import br.com.blitz.usuario.Papel;
import br.com.blitz.usuario.UsuarioRepository;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Primeiro administrador: a conta cujo e-mail é ADMIN_EMAIL vira ADMINISTRADOR (no start e no cadastro). */
@Configuration
public class AdminBootstrap {
    @Bean
    ApplicationRunner promoverAdmin(UsuarioRepository usuarios, @Value("${blitz.admin-email}") String adminEmail) {
        return args -> {
            if (adminEmail == null || adminEmail.isBlank()) return;
            usuarios.findByEmailIgnoreCase(adminEmail.trim()).filter(u -> u.papel != Papel.ADMINISTRADOR).ifPresent(u -> {
                u.papel = Papel.ADMINISTRADOR;
                usuarios.save(u);
                LoggerFactory.getLogger(AdminBootstrap.class).info("Conta {} promovida a ADMINISTRADOR (ADMIN_EMAIL).", u.id);
            });
        };
    }
}
