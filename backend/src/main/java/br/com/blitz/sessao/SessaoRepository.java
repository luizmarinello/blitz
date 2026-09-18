package br.com.blitz.sessao;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SessaoRepository extends JpaRepository<SessaoFoco, Long> {
    Optional<SessaoFoco> findFirstByUsuarioIdAndFimIsNull(Long usuarioId);
    Optional<SessaoFoco> findByIdAndUsuarioId(Long id, Long usuarioId);
    List<SessaoFoco> findTop50ByUsuarioIdAndFimIsNotNullOrderByInicioDesc(Long usuarioId);
    List<SessaoFoco> findByUsuarioIdAndFimIsNotNullAndInicioAfter(Long usuarioId, Instant desde);
    List<SessaoFoco> findByUsuarioIdOrderByInicioDesc(Long usuarioId);
    long countByUsuarioIdAndFimIsNotNull(Long usuarioId);
}
