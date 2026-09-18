package br.com.blitz.tarefa;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** RF06–RF08. ck_tarefa_conclusao: CONCLUIDA <=> concluidaEm != null; garantido em mudarStatus(). */
@Entity @Table(name = "tarefa")
public class Tarefa {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Long id;
    @Column(name = "lista_id") public Long listaId;
    @Column(name = "sprint_id") public Long sprintId;
    public String titulo;
    public String descricao;
    @Enumerated(EnumType.STRING) @JdbcTypeCode(SqlTypes.NAMED_ENUM) public Prioridade prioridade = Prioridade.MEDIA;
    @Column(name = "horas_estimadas") public BigDecimal horasEstimadas;
    public LocalDate prazo;
    @Enumerated(EnumType.STRING) @JdbcTypeCode(SqlTypes.NAMED_ENUM) public StatusTarefa status = StatusTarefa.BACKLOG;
    public int posicao;
    @Column(name = "concluida_em") public Instant concluidaEm;
    @Column(name = "criado_em") public Instant criadoEm;
    @Column(name = "atualizado_em") public Instant atualizadoEm;

    public void mudarStatus(StatusTarefa novo) {
        status = novo;
        concluidaEm = novo == StatusTarefa.CONCLUIDA ? (concluidaEm == null ? Instant.now() : concluidaEm) : null;
    }

    @PrePersist void criar() { criadoEm = atualizadoEm = Instant.now(); }
    @PreUpdate void atualizar() { atualizadoEm = Instant.now(); }
}
