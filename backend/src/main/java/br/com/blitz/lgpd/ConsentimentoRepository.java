package br.com.blitz.lgpd;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ConsentimentoRepository extends JpaRepository<Consentimento, Long> {
    List<Consentimento> findByUsuarioIdOrderByAceitoEmDesc(Long usuarioId);
}
