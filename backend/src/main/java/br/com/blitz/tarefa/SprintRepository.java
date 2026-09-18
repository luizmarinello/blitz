package br.com.blitz.tarefa;

import java.time.LocalDate;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SprintRepository extends JpaRepository<Sprint, Long> {
    Optional<Sprint> findFirstByUsuarioIdAndDataInicioLessThanEqualAndDataFimGreaterThanEqual(Long usuarioId, LocalDate ate, LocalDate desde);

    default Optional<Sprint> vigente(Long usuarioId, LocalDate hoje) {
        return findFirstByUsuarioIdAndDataInicioLessThanEqualAndDataFimGreaterThanEqual(usuarioId, hoje, hoje);
    }
}
