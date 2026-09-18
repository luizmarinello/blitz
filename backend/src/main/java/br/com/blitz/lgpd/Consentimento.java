package br.com.blitz.lgpd;

import jakarta.persistence.*;
import java.time.Instant;

/** Histórico: só INSERT, nunca UPDATE (decisão de modelagem, seção 3 do CLAUDE.md). RNF-LGPD06. */
@Entity @Table(name = "consentimento")
public class Consentimento {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Long id;
    @Column(name = "usuario_id") public Long usuarioId;
    @Column(name = "versao_politica") public String versaoPolitica;
    @Column(name = "aceito_em") public Instant aceitoEm;
    public String canal = "WEB";
    public String finalidade;

    @PrePersist void criar() { aceitoEm = Instant.now(); }
}
