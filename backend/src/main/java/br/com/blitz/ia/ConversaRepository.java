package br.com.blitz.ia;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface ConversaRepository extends JpaRepository<ConversaIa, Long> {
    @Query("select coalesce(sum(c.tokensUsados), 0) from ConversaIa c where c.usuarioId = :u and c.dataHora >= :desde")
    long tokensDesde(Long u, Instant desde);

    Optional<ConversaIa> findFirstByUsuarioIdAndDataHoraAfterAndTokensUsadosGreaterThanOrderByDataHoraAsc(Long u, Instant desde, int min);

    List<ConversaIa> findTop20ByUsuarioIdOrderByDataHoraDesc(Long u);

    @Modifying
    @Query("update ConversaIa c set c.mensagem = :marca, c.resposta = null where c.dataHora < :limite and c.mensagem <> :marca")
    int apagarConteudoAntes(Instant limite, String marca);
    List<ConversaIa> findByUsuarioIdOrderByDataHoraAsc(Long u);
    void deleteByUsuarioId(Long u);
}
