package br.com.blitz.auth;

import br.com.blitz.usuario.UsuarioRepository;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;

/**
 * RN01: toda rota /api (exceto /api/auth) exige autenticação.
 * Sessão via cookie HttpOnly + SameSite=Strict; o front é servido pelo próprio Spring (mesma origem).
 * ponytail: CSRF desativado porque o cookie é SameSite=Strict e a API só aceita JSON; reativar se o front sair da mesma origem.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    SecurityFilterChain filtros(HttpSecurity http) throws Exception {
        return http
            .csrf(c -> c.disable())
            .formLogin(f -> f.disable())
            .httpBasic(b -> b.disable())
            .logout(l -> l.disable())
            .securityContext(s -> s.securityContextRepository(contextRepository()))
            .authorizeHttpRequests(a -> a
                .requestMatchers("/api/auth/**").permitAll()
                .requestMatchers("/api/admin/**").hasRole("ADMINISTRADOR")   // RN04
                .requestMatchers("/api/gestor/**").hasAnyRole("GESTOR", "ADMINISTRADOR")   // RF21
                .requestMatchers("/api/**").authenticated()
                .anyRequest().permitAll())                                   // front estático
            .exceptionHandling(e -> e.authenticationEntryPoint((req, res, ex) -> {
                res.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                res.setContentType("application/json;charset=UTF-8");
                res.getWriter().write("{\"mensagem\":\"Faça login para continuar.\"}");
            }))
            .build();
    }

    @Bean SecurityContextRepository contextRepository() { return new HttpSessionSecurityContextRepository(); }

    @Bean PasswordEncoder encoder() { return new BCryptPasswordEncoder(); }   // RNF-LGPD05

    @Bean
    UserDetailsService userDetailsService(UsuarioRepository repo) {
        return email -> repo.findByEmailIgnoreCase(email).map(UsuarioAutenticado::de)
            .orElseThrow(() -> new UsernameNotFoundException(email));
    }

    @Bean
    AuthenticationManager authenticationManager(UserDetailsService uds, PasswordEncoder enc) {
        DaoAuthenticationProvider p = new DaoAuthenticationProvider(uds);
        p.setPasswordEncoder(enc);
        return new ProviderManager(p);
    }
}
