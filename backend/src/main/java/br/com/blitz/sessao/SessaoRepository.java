package br.com.blitz.sessao;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface SessaoRepository extends JpaRepository<SessaoFoco, Long> {
    Optional<SessaoFoco> findFirstByUsuarioIdAndFimIsNull(Long usuarioId);
    Optional<SessaoFoco> findByIdAndUsuarioId(Long id, Long usuarioId);
    List<SessaoFoco> findTop50ByUsuarioIdAndFimIsNotNullOrderByInicioDesc(Long usuarioId);
    List<SessaoFoco> findByUsuarioIdAndFimIsNotNullAndInicioAfter(Long usuarioId, Instant desde);
    List<SessaoFoco> findByUsuarioIdOrderByInicioDesc(Long usuarioId);
    long countByUsuarioIdAndFimIsNotNull(Long usuarioId);

    /** [tarefaId, segundos, sessões] das sessões encerradas e ainda vinculadas a uma tarefa. */
    @Query("select s.tarefaId, coalesce(sum(s.duracaoSegundos), 0), count(s) from SessaoFoco s "
         + "where s.usuarioId = :u and s.fim is not null and s.tarefaId is not null group by s.tarefaId")
    List<Object[]> focoPorTarefa(Long u);
}
