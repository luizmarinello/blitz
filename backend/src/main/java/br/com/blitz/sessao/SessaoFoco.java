package br.com.blitz.sessao;

import jakarta.persistence.*;
import java.time.Instant;

/** UC03 / RF10, RF11, RN03. Sessão em andamento: fim e duracaoSegundos nulos. */
@Entity @Table(name = "sessao_foco")
public class SessaoFoco {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Long id;
    @Column(name = "usuario_id") public Long usuarioId;
    @Column(name = "tarefa_id") public Long tarefaId;
    @Column(name = "modo_id") public Long modoId;
    public Instant inicio;
    public Instant fim;
    @Column(name = "duracao_segundos") public Integer duracaoSegundos;

    @PrePersist void criar() { if (inicio == null) inicio = Instant.now(); }
}
