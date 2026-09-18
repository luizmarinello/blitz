package br.com.blitz.auth;

import br.com.blitz.usuario.Usuario;
import java.util.List;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

/** Principal guardado na sessão. Só o necessário: id, email, hash, papel, ativo. */
public record UsuarioAutenticado(Long id, String email, String senhaHash, String papel, boolean ativo) implements UserDetails {
    public static UsuarioAutenticado de(Usuario u) {
        return new UsuarioAutenticado(u.id, u.email, u.senhaHash, u.papel.name(), u.ativo);
    }
    @Override public List<GrantedAuthority> getAuthorities() { return List.of(new SimpleGrantedAuthority("ROLE_" + papel)); }
    @Override public String getPassword() { return senhaHash; }
    @Override public String getUsername() { return email; }
    @Override public boolean isEnabled() { return ativo; }
}
