package br.com.blitz.comum;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

public class NaoEncontrado extends ResponseStatusException {
    // RF04: mensagem em pt-BR sem "(a)". Os nomes usados (Lista, Tarefa, Sessão, Organização) são femininos; Modo e Usuário, masculinos.
    public NaoEncontrado(String oQue) {
        super(HttpStatus.NOT_FOUND, oQue + (oQue.endsWith("a") || oQue.endsWith("ão") ? " não encontrada." : " não encontrado."));
    }
}
