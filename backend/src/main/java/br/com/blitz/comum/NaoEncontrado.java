package br.com.blitz.comum;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

public class NaoEncontrado extends ResponseStatusException {
    public NaoEncontrado(String oQue) { super(HttpStatus.NOT_FOUND, oQue + " não encontrado(a)."); }
}
