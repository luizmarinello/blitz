package br.com.blitz.tarefa;

import jakarta.persistence.*;
import java.time.Instant;

@Entity @Table(name = "lista")
public class Lista {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Long id;
    @Column(name = "usuario_id") public Long usuarioId;
    public String nome;
    public int posicao;
    @Column(name = "criado_em") public Instant criadoEm;

    @PrePersist void criar() { criadoEm = Instant.now(); }
}
