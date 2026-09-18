package br.com.blitz.tarefa;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ListaRepository extends JpaRepository<Lista, Long> {
    List<Lista> findByUsuarioIdOrderByPosicaoAscIdAsc(Long usuarioId);
    Optional<Lista> findByIdAndUsuarioId(Long id, Long usuarioId);
    long countByUsuarioId(Long usuarioId);
    void deleteByUsuarioId(Long usuarioId);
}
