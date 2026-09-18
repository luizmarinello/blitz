package br.com.blitz.modo;

import jakarta.persistence.*;

/** UC05 / RF12. Predefinido => usuarioId NULL; personalizado => usuarioId obrigatório (ck_modo_predefinido). */
@Entity @Table(name = "modo_concentracao")
public class ModoConcentracao {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Long id;
    @Column(name = "usuario_id") public Long usuarioId;
    public String nome;
    public String descricao;
    @Column(name = "ciclo_foco_min") public short cicloFocoMin;
    @Column(name = "ciclo_pausa_min") public short cicloPausaMin;
    public boolean predefinido;
}
