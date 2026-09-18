package br.com.blitz.tarefa;

import jakarta.persistence.*;
import java.time.LocalDate;

/** RF09. Uma sprint por semana (segunda a domingo) por usuário; tarefas apontam por sprint_id (ON DELETE SET NULL). */
@Entity @Table(name = "sprint")
public class Sprint {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Long id;
    @Column(name = "usuario_id") public Long usuarioId;
    @Column(name = "data_inicio") public LocalDate dataInicio;
    @Column(name = "data_fim") public LocalDate dataFim;
    @Column(name = "gerada_por_ia") public boolean geradaPorIa;
}
