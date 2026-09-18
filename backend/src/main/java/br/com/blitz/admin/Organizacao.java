package br.com.blitz.admin;

import jakarta.persistence.*;
import java.time.Instant;

/** Frente B2B. Usuários apontam para cá por organizacao_id (ON DELETE SET NULL). */
@Entity @Table(name = "organizacao")
public class Organizacao {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Long id;
    public String nome;
    @Column(name = "licencas_totais") public int licencasTotais;
    @Column(name = "criado_em") public Instant criadoEm;

    @PrePersist void criar() { criadoEm = Instant.now(); }
}
