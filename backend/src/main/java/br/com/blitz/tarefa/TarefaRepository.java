package br.com.blitz.tarefa;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface TarefaRepository extends JpaRepository<Tarefa, Long> {
    @Query("select t from Tarefa t where t.listaId in (select l.id from Lista l where l.usuarioId = :u) order by t.listaId, t.posicao, t.id")
    List<Tarefa> todasDoUsuario(Long u);

    @Query("select t from Tarefa t join Lista l on l.id = t.listaId where t.id = :id and l.usuarioId = :u")
    Optional<Tarefa> doUsuario(Long id, Long u);

    @Query("select count(t) from Tarefa t join Lista l on l.id = t.listaId where l.usuarioId = :u and t.status = :status")
    long contarPorStatus(Long u, StatusTarefa status);

    default long concluidasDoUsuario(Long u) { return contarPorStatus(u, StatusTarefa.CONCLUIDA); }

    @Query("select coalesce(max(t.posicao), 0) + 1 from Tarefa t where t.listaId = :listaId")
    int proximaPosicao(Long listaId);
}
