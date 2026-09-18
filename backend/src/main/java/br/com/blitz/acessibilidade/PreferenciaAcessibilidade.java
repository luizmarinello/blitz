package br.com.blitz.acessibilidade;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.Instant;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** UC12, RA04–RA06, RN08. PK = FK garante a cardinalidade 1:1. */
@Entity @Table(name = "preferencia_acessibilidade")
public class PreferenciaAcessibilidade {
    @Id @JsonIgnore @Column(name = "usuario_id") public Long usuarioId;
    @Enumerated(EnumType.STRING) @JdbcTypeCode(SqlTypes.NAMED_ENUM) public Tema tema = Tema.CLARO;
    @Enumerated(EnumType.STRING) @JdbcTypeCode(SqlTypes.NAMED_ENUM) @Column(name = "tamanho_fonte") public TamanhoFonte tamanhoFonte = TamanhoFonte.MEDIO;
    @Column(name = "reduzir_animacoes") public boolean reduzirAnimacoes;
    @Column(name = "leitor_tela") public boolean leitorTela;
    @Column(name = "atualizado_em") public Instant atualizadoEm;

    @PrePersist @PreUpdate void marcar() { atualizadoEm = Instant.now(); }
}
