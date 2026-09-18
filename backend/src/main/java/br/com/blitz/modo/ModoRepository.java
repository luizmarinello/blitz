package br.com.blitz.modo;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ModoRepository extends JpaRepository<ModoConcentracao, Long> {
    @Query("select m from ModoConcentracao m where m.predefinido = true or m.usuarioId = :u order by m.predefinido desc, m.id asc")
    List<ModoConcentracao> visiveisPara(Long u);

    @Query("select m from ModoConcentracao m where m.id = :id and (m.predefinido = true or m.usuarioId = :u)")
    Optional<ModoConcentracao> visivelPara(Long id, Long u);

    Optional<ModoConcentracao> findByIdAndUsuarioId(Long id, Long usuarioId);
    List<ModoConcentracao> findByUsuarioId(Long usuarioId);
}
