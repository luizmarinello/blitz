package br.com.blitz.usuario;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.Instant;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity @Table(name = "usuario")
public class Usuario {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Long id;
    @Column(name = "organizacao_id") public Long organizacaoId;
    public String nome;
    public String email;
    @JsonIgnore @Column(name = "senha_hash") public String senhaHash;
    @Enumerated(EnumType.STRING) @JdbcTypeCode(SqlTypes.NAMED_ENUM) public Papel papel = Papel.USUARIO;
    public boolean ativo = true;
    @Column(name = "anonimizado_em") public Instant anonimizadoEm;
    @Column(name = "criado_em") public Instant criadoEm;
    @Column(name = "atualizado_em") public Instant atualizadoEm;

    @PrePersist void criar() { criadoEm = atualizadoEm = Instant.now(); }
    @PreUpdate void atualizar() { atualizadoEm = Instant.now(); }
}
