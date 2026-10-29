package br.com.blitz.auth;

import br.com.blitz.usuario.UsuarioRepository;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
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
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

/**
 * RN01: toda rota /api (exceto /api/auth) exige autenticação.
 * Sessão via cookie HttpOnly. Mesma origem (dev/jar único): SameSite=Strict, sem CORS.
 * Front publicado separado (Render Static Site): FRONT_URL libera CORS só para essa origem e COOKIE_SAMESITE=none.
 * ponytail: CSRF desativado porque a API só aceita JSON e o CORS restringe a origem (preflight barra outras);
 * reativar com token se algum endpoint passar a aceitar formulário.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    SecurityFilterChain filtros(HttpSecurity http, @Value("${blitz.front-url}") String frontUrl) throws Exception {
        return http
            .cors(c -> c.configurationSource(cors(frontUrl)))
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

    /** RNF04/RN01: só a origem do front publicado pode chamar a API com cookie. Vazio = mesma origem, CORS fechado. */
    private static CorsConfigurationSource cors(String frontUrl) {
        CorsConfiguration cfg = new CorsConfiguration();
        if (!frontUrl.isBlank()) {
            cfg.setAllowedOrigins(List.of(frontUrl.replaceAll("/+$", "")));
            cfg.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
            cfg.setAllowedHeaders(List.of("Content-Type"));
            cfg.setAllowCredentials(true);
        }
        UrlBasedCorsConfigurationSource src = new UrlBasedCorsConfigurationSource();
        src.registerCorsConfiguration("/api/**", cfg);
        return src;
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
