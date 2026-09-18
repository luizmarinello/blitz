package br.com.blitz.ia;

import jakarta.persistence.*;
import java.time.Instant;

/**
 * UC04 / RF15. tokensUsados é a base do limite por usuário (RNF09).
 * Pendência nº 7 (achado IA-02): reduzir a persistência de mensagem/resposta ao mínimo. Hoje o schema exige mensagem NOT NULL;
 * mudar isso passa por discussão da modelagem (seção 3 do CLAUDE.md), não por aqui.
 */
@Entity @Table(name = "conversa_ia")
public class ConversaIa {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Long id;
    @Column(name = "usuario_id") public Long usuarioId;
    public String mensagem;
    public String resposta;
    @Column(name = "tokens_usados") public Integer tokensUsados;
    @Column(name = "data_hora") public Instant dataHora;

    @PrePersist void criar() { dataHora = Instant.now(); }
}
