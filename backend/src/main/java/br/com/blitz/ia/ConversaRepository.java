package br.com.blitz.ia;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ConversaRepository extends JpaRepository<ConversaIa, Long> {
    @Query("select coalesce(sum(c.tokensUsados), 0) from ConversaIa c where c.usuarioId = :u and c.dataHora >= :desde")
    long tokensDesde(Long u, Instant desde);

    Optional<ConversaIa> findFirstByUsuarioIdAndDataHoraAfterAndTokensUsadosGreaterThanOrderByDataHoraAsc(Long u, Instant desde, int min);

    List<ConversaIa> findTop20ByUsuarioIdOrderByDataHoraDesc(Long u);
    List<ConversaIa> findByUsuarioIdOrderByDataHoraAsc(Long u);
    void deleteByUsuarioId(Long u);
}
