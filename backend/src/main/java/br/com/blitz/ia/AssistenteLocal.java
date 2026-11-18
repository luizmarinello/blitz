package br.com.blitz.ia;

import br.com.blitz.tarefa.Prioridade;
import br.com.blitz.tarefa.StatusTarefa;
import br.com.blitz.tarefa.Tarefa;
import java.text.Normalizer;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.TextStyle;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Assistente local, sem LLM (RF15, RF16, RF17). Identifica a intenção da pergunta por palavras-chave (pt-BR, sem acento)
 * e responde com os dados da própria pessoa: tarefas, prazos, horas estimadas, tempo de foco e modos de concentração.
 * Nenhum número é inventado: tudo sai do {@link Contexto}. Função pura (sem banco), por isso testável em AssistenteLocalTest.
 * Usado quando a chave da IA não está configurada, quando o provedor falha e quando o limite diário de tokens acaba.
 */
final class AssistenteLocal {
    private AssistenteLocal() {}

    static final ZoneId FUSO = ZoneId.of("America/Sao_Paulo");
    private static final Locale PT = Locale.forLanguageTag("pt-BR");
    private static final DateTimeFormatter DATA = DateTimeFormatter.ofPattern("dd/MM");

    record Modo(String nome, int focoMin, int pausaMin) {}
    record Contexto(List<Tarefa> tarefas, Map<Long, Long> focoPorTarefaSeg, long focoHojeSeg, long focoSemanaSeg,
                    int sessoesSemana, List<Modo> modos, LocalDate hoje) {}
    record Resposta(String texto, List<Long> ordem) {}
    record Avaliada(Tarefa t, int pontos, List<String> motivos) {}

    enum Intencao { SAUDACAO, AGRADECIMENTO, AJUDA, CONCLUI, PROXIMA, TEMPO, PRAZOS, CARGA, RESUMO, MODO, DIVIDIR, DICAS, AGORA, TAREFA, DESCONHECIDA }

    // Ordem do mapa = desempate: a intenção mais específica vem antes da genérica ("o que vence hoje" é PRAZOS, não AGORA).
    private static final Map<Intencao, List<String>> CHAVES = new LinkedHashMap<>();
    static {
        CHAVES.put(Intencao.AJUDA, List.of("ajuda", "o que voce faz", "o que voce sabe", "o que voce pode", "como funciona", "como voce funciona", "comandos", "como usar", "o que posso perguntar"));
        CHAVES.put(Intencao.CONCLUI, List.of("terminei", "conclui", "acabei", "finalizei", "entreguei", "ja fiz"));
        CHAVES.put(Intencao.PROXIMA, List.of("proxima", "proximo", "depois disso", "em seguida", "e depois", "outra tarefa", "outra opcao", "mais alguma"));
        CHAVES.put(Intencao.TEMPO, List.of("menos de", "rapida", "rapido", "rapidas", "curta", "facil", "faceis", "pouco tempo", "intervalo", "terminar em", "tempo livre"));
        CHAVES.put(Intencao.PRAZOS, List.of("atrasad", "prazo", " venc", "entrega", "deadline", "agenda", "data limite"));
        CHAVES.put(Intencao.CARGA, List.of("quantas horas", " carga", "sobrecarreg", "da tempo", "dar tempo", "consigo terminar", "capacidade", "quanto trabalho", "muita coisa", "volume", "horas no total", "quanto falta"));
        CHAVES.put(Intencao.RESUMO, List.of("resumo", "status", "progresso", "como estou", "como to", "como eu estou", "como foi", "minha semana", "relatorio da semana", "relatorio semanal", "produtiv", "quanto foquei", "tempo de foco", "metrica", "estatistic", "desempenho", "balanco"));
        CHAVES.put(Intencao.MODO, List.of(" modo", "pomodoro", "profundo", "relax", "tecnica", "cronometro", "timer", " ciclo"));
        CHAVES.put(Intencao.DIVIDIR, List.of("dividir", "divido", "quebrar", "quebro", "subtarefa", "etapa", "passo a passo", "muito grande", "grande demais", "como comecar", "como comeco", "planejar a tarefa"));
        CHAVES.put(Intencao.DICAS, List.of(" dica", "procrastin", "distra", "concentr", "motiva", "preguica", "cansad", "exausto", "ansios", "estress", "travad", "nao consigo", "desanim", " sono", "sem foco", "perdendo o foco"));
        CHAVES.put(Intencao.AGORA, List.of("agora", "comecar", "comeco", "priori", "ordem", "orden", "urgen", "importante", "o que fazer", "o que faco", "qual tarefa", "por onde", "sugest", "hoje", "decid", "escolh", "focar"));
    }
    private static final Pattern SAUDACAO = Pattern.compile("^(oi|ola|opa|bom dia|boa tarde|boa noite|e ai|eai|hey|hello|salve)\\b");
    private static final Pattern AGRADECE = Pattern.compile("\\b(obrigad\\w*|valeu|vlw|brigad\\w*|perfeito|otimo|show|massa|top)\\b");
    private static final Set<String> VAZIAS = Set.of("para", "pra", "com", "sem", "sobre", "fazer", "tarefa", "tarefas", "minha", "minhas", "meu", "meus",
        "este", "esta", "isso", "esse", "essa", "agora", "hoje", "amanha", "como", "qual", "quais", "mais", "muito", "quando", "onde", "porque", "entre",
        "depois", "antes", "ainda", "tenho", "quero", "preciso", "devo", "posso", "dividir", "terminei", "conclui", "acabei", "prazo", "modo");

    // ---------- entrada ----------

    static String normalizar(String s) {
        return Normalizer.normalize(s == null ? "" : s, Normalizer.Form.NFD).replaceAll("\\p{M}", "")
            .toLowerCase(Locale.ROOT).replaceAll("\\s+", " ").trim();
    }

    /** Minutos citados na mensagem ("30 min", "1h30", "1,5 hora", "meia hora", "uma hora e meia"); null se não houver. */
    static Integer minutosCitados(String norm) {
        Matcher hm = Pattern.compile("(\\d+)\\s*h\\s*(\\d{1,2})\\b").matcher(norm);
        if (hm.find()) return Integer.parseInt(hm.group(1)) * 60 + Integer.parseInt(hm.group(2));
        Matcher m = Pattern.compile("(\\d+(?:[.,]\\d+)?)\\s*(h|hr|hrs|hora|horas|min|mins|minuto|minutos)\\b").matcher(norm);
        if (m.find()) {
            double v = Double.parseDouble(m.group(1).replace(',', '.'));
            return (int) Math.round(m.group(2).startsWith("m") ? v : v * 60);
        }
        if (norm.contains("hora e meia")) return norm.contains("duas hora") ? 150 : 90;
        if (norm.contains("meia hora")) return 30;
        if (norm.matches(".*\\b(uma|1) hora\\b.*")) return 60;
        if (norm.contains("duas horas")) return 120;
        if (norm.contains("tres horas")) return 180;
        return null;
    }

    static Intencao intencao(String norm) {
        Intencao melhor = null; int max = 0;
        String alvo = " " + norm + " ";   // chaves com espaço na frente só casam no início da palavra (" modo" não casa "incomodo")
        for (var e : CHAVES.entrySet()) {
            int n = 0;
            for (String c : e.getValue()) if (alvo.contains(c)) n++;
            if (e.getKey() == Intencao.TEMPO && minutosCitados(norm) != null) n += 2;
            if (n > max) { max = n; melhor = e.getKey(); }
        }
        if (melhor != null) return melhor;
        if (SAUDACAO.matcher(norm).find()) return Intencao.SAUDACAO;
        if (AGRADECE.matcher(norm).find()) return Intencao.AGRADECIMENTO;
        return null;   // quem chama decide entre TAREFA (título citado) e DESCONHECIDA
    }

    /** Tarefa citada pela pessoa: "#12" ou palavras do título (≥ metade das palavras significativas, 2 delas,
     *  ou uma palavra de 5+ letras que só aparece no título dessa tarefa, como "slides" em "Revisar slides da apresentação"). */
    static Tarefa mencionada(String norm, List<Tarefa> tarefas) {
        Matcher id = Pattern.compile("#(\\d+)").matcher(norm);
        if (id.find()) {
            long n = Long.parseLong(id.group(1));
            for (Tarefa t : tarefas) if (Objects.equals(t.id, n)) return t;
        }
        Set<String> palavras = new HashSet<>(Arrays.asList(norm.split("[^a-z0-9]+")));
        Map<Tarefa, List<String>> sigs = new LinkedHashMap<>();
        Map<String, Integer> emQuantas = new HashMap<>();
        for (Tarefa t : tarefas) {
            List<String> sig = Arrays.stream(normalizar(t.titulo).split("[^a-z0-9]+")).filter(w -> w.length() >= 4 && !VAZIAS.contains(w)).distinct().toList();
            sigs.put(t, sig);
            sig.forEach(w -> emQuantas.merge(w, 1, Integer::sum));
        }
        Tarefa melhor = null; double melhorFrac = 0; int melhorHits = 0;
        for (var e : sigs.entrySet()) {
            List<String> sig = e.getValue();
            if (sig.isEmpty()) continue;
            int hits = (int) sig.stream().filter(palavras::contains).count();
            double frac = (double) hits / sig.size();
            boolean unica = sig.stream().anyMatch(w -> w.length() >= 5 && palavras.contains(w) && emQuantas.get(w) == 1);
            Tarefa t = e.getKey();
            if (hits >= 1 && (frac >= 0.5 || hits >= 2 || unica) && (frac > melhorFrac || (frac == melhorFrac && hits > melhorHits))) {
                melhor = t; melhorFrac = frac; melhorHits = hits;
            }
        }
        return melhor;
    }

    // ---------- priorização (mesmo critério do "Comece por aqui" do quadro, em frontend/src/prioridade.ts) ----------

    /** Urgência do prazo + prioridade + "terminar o que começou" + vitória rápida. Cada ponto vira um motivo legível. */
    static Avaliada avaliar(Tarefa t, LocalDate hoje) {
        int p = 0; List<String> m = new ArrayList<>(); Long dias = null;
        if (t.prazo != null) {
            dias = ChronoUnit.DAYS.between(hoje, t.prazo);
            if (dias < 0) { p += 100 + (int) Math.min(30, -dias * 5); m.add("atrasada há " + plural(-dias, "dia", "dias")); }
            else if (dias == 0) { p += 80; m.add("vence hoje"); }
            else if (dias == 1) { p += 60; m.add("vence amanhã"); }
            else if (dias <= 3) { p += 45; m.add("vence " + diaSemana(t.prazo) + " (em " + dias + " dias)"); }
            else if (dias <= 7) { p += 30; m.add("vence em " + dias + " dias"); }
            else p += 10;
        }
        if (t.prioridade == Prioridade.ALTA) { p += 30; m.add("prioridade alta"); }
        else if (t.prioridade == Prioridade.MEDIA) p += 15;
        if (t.status == StatusTarefa.EM_ANDAMENTO) { p += 12; m.add("já está em andamento"); }
        Double h = horas(t);
        if (h != null) {
            if (h <= 1) { p += 8; m.add("rápida, " + fmtHoras(h)); }
            else if (h >= 4 && (dias == null || dias > 7)) p -= 5;
        }
        return new Avaliada(t, p, m);
    }

    static List<Avaliada> ranking(Contexto c) {
        return c.tarefas().stream().filter(t -> t.status != StatusTarefa.CONCLUIDA).map(t -> avaliar(t, c.hoje()))
            .sorted(Comparator.comparingInt((Avaliada a) -> -a.pontos())
                .thenComparing(a -> a.t().prazo, Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(a -> a.t().id, Comparator.nullsLast(Comparator.naturalOrder())))
            .toList();
    }

    // ---------- resposta ----------

    static Resposta responder(String mensagem, Contexto c) {
        String norm = normalizar(mensagem);
        Tarefa citada = mencionada(norm, c.tarefas());
        // as palavras do título citado não contam como intenção ("e o relatório de status?" é sobre a tarefa, não um resumo)
        String semTitulo = norm;
        if (citada != null) for (String w : normalizar(citada.titulo).split("[^a-z0-9]+")) if (w.length() >= 4) semTitulo = semTitulo.replaceAll("\\b" + w + "\\b", " ");
        Intencao i = intencao(semTitulo.replaceAll("\\s+", " ").trim());
        if (i == null) i = citada != null ? Intencao.TAREFA : Intencao.DESCONHECIDA;
        List<Avaliada> fila = ranking(c);
        return switch (i) {
            case SAUDACAO -> saudacao(fila, c);
            case AGRADECIMENTO -> new Resposta("Por nada! Quando quiser, pergunte o que fazer agora ou peça um resumo da semana. Bom foco.", List.of());
            case AJUDA -> new Resposta(AJUDA_TEXTO, List.of());
            case CONCLUI -> concluiu(citada, fila);
            case PROXIMA -> proxima(fila);
            case TEMPO -> tempoLivre(norm, fila);
            case PRAZOS -> prazos(c);
            case CARGA -> carga(c, fila);
            case RESUMO -> resumo(c, fila);
            case MODO -> modo(norm, citada, fila, c);
            case DIVIDIR -> dividir(citada, fila, c);
            case DICAS -> dicas(norm, fila, c);
            case AGORA -> agora(fila, c);
            case TAREFA -> tarefa(citada, fila, c);
            case DESCONHECIDA -> desconhecida(fila);
        };
    }

    private static final String SEM_TAREFAS = "Você não tem tarefas pendentes. Cadastre a primeira no quadro (por exemplo, \"Revisar slides !alta @sexta 2h\" na entrada rápida) e eu ajudo a decidir por onde começar.";

    private static final String AJUDA_TEXTO = """
        Eu respondo a partir das suas tarefas, prazos, estimativas e tempo de foco. Experimente:
        • "O que devo fazer agora?" ordena por urgência, prioridade e esforço
        • "Tenho 30 minutos, o que dá para fazer?" escolhe o que cabe no tempo
        • "O que está atrasado?" ou "O que vence esta semana?"
        • "Vai dar tempo esta semana?" compara horas estimadas com o seu ritmo de foco
        • "Como foi minha semana?" resume foco e tarefas concluídas
        • "Qual modo de foco devo usar?" ou "Como dividir o relatório?"
        • "Estou procrastinando" ou "Estou cansado" para dicas e uma tarefa adequada""";

    private static Resposta saudacao(List<Avaliada> fila, Contexto c) {
        if (fila.isEmpty()) return new Resposta("Olá! " + SEM_TAREFAS, List.of());
        long atrasadas = fila.stream().filter(a -> a.t().prazo != null && a.t().prazo.isBefore(c.hoje())).count();
        String s = "Olá! Você tem " + plural(fila.size(), "tarefa pendente", "tarefas pendentes")
            + (atrasadas > 0 ? ", " + plural(atrasadas, "atrasada", "atrasadas") : "") + ". "
            + "Minha sugestão para começar: " + linha(fila.get(0)) + ".\nPergunte \"ajuda\" para ver tudo o que eu sei responder.";
        return new Resposta(s, List.of(fila.get(0).t().id));
    }

    private static Resposta agora(List<Avaliada> fila, Contexto c) {
        if (fila.isEmpty()) return new Resposta(SEM_TAREFAS, List.of());
        List<Avaliada> top = fila.subList(0, Math.min(5, fila.size()));
        StringBuilder sb = new StringBuilder("Comece por ").append(linha(top.get(0))).append('.');
        if (top.size() > 1) {
            sb.append("\n\nDepois:");
            for (int k = 1; k < top.size(); k++) sb.append('\n').append(k + 1).append(". ").append(linha(top.get(k)));
        }
        String modo = modoPara(top.get(0).t(), c, false);
        if (modo != null) sb.append("\n\n").append(modo);
        long atrasadas = fila.stream().filter(a -> a.t().prazo != null && a.t().prazo.isBefore(c.hoje())).count();
        if (atrasadas > 1) sb.append("\nVocê tem ").append(atrasadas).append(" tarefas atrasadas: se nem todas couberem hoje, vale renegociar o prazo das de menor prioridade.");
        if (fila.size() > 5) sb.append("\nCritério: prazo mais próximo, prioridade, o que já está em andamento e tarefas rápidas.");
        return new Resposta(sb.toString(), ids(top));
    }

    private static Resposta proxima(List<Avaliada> fila) {
        if (fila.size() < 2) return new Resposta(fila.isEmpty() ? SEM_TAREFAS : "Só resta uma tarefa pendente: " + linha(fila.get(0)) + ".", ids(fila));
        List<Avaliada> resto = fila.subList(1, Math.min(4, fila.size()));
        StringBuilder sb = new StringBuilder("Depois de \"").append(fila.get(0).t().titulo).append("\", a próxima é ").append(linha(resto.get(0))).append('.');
        for (int k = 1; k < resto.size(); k++) sb.append(k == 1 ? "\nEm seguida: " : "; ").append(linha(resto.get(k)));
        return new Resposta(sb.toString(), ids(resto));
    }

    private static Resposta tempoLivre(String norm, List<Avaliada> fila) {
        if (fila.isEmpty()) return new Resposta(SEM_TAREFAS, List.of());
        Integer citado = minutosCitados(norm);
        int disponivel = citado != null ? citado : 60;
        List<Avaliada> cabem = new ArrayList<>(); int soma = 0;
        for (Avaliada a : fila) {   // a fila já vem por importância: guloso pelo mais importante que ainda cabe
            Double h = horas(a.t());
            if (h == null) continue;
            int min = (int) Math.round(h * 60);
            if (soma + min <= disponivel) { cabem.add(a); soma += min; }
        }
        long semEstimativa = fila.stream().filter(a -> a.t().horasEstimadas == null).count();
        String janela = fmtMin(disponivel) + (citado == null ? " (considerei 1 hora; diga quanto tempo você tem)" : "");
        StringBuilder sb = new StringBuilder();
        if (cabem.isEmpty()) {
            sb.append("Nenhuma tarefa com estimativa cabe em ").append(janela).append(". ")
              .append("Use o tempo para avançar em ").append(linha(fila.get(0))).append(": um bloco de foco já faz diferença.");
            if (semEstimativa > 0) sb.append("\n").append(plural(semEstimativa, "tarefa está", "tarefas estão")).append(" sem horas estimadas; estimar ajuda a encaixar melhor.");
            return new Resposta(sb.toString(), List.of(fila.get(0).t().id));
        }
        sb.append("Com ").append(janela).append(", dá para fazer:");
        int k = 1;
        for (Avaliada a : cabem) sb.append('\n').append(k++).append(". \"").append(a.t().titulo).append("\" (").append(fmtHoras(horas(a.t()))).append(')');
        sb.append("\nTotal estimado: ").append(fmtMin(soma)).append(" de ").append(fmtMin(disponivel)).append('.');
        if (semEstimativa > 0) sb.append("\nFicaram de fora ").append(plural(semEstimativa, "tarefa sem estimativa", "tarefas sem estimativa")).append('.');
        return new Resposta(sb.toString(), ids(cabem));
    }

    private static Resposta prazos(Contexto c) {
        LocalDate hoje = c.hoje();
        List<Tarefa> pend = c.tarefas().stream().filter(t -> t.status != StatusTarefa.CONCLUIDA && t.prazo != null)
            .sorted(Comparator.comparing((Tarefa t) -> t.prazo)).toList();
        List<Tarefa> atrasadas = pend.stream().filter(t -> t.prazo.isBefore(hoje)).toList();
        List<Tarefa> deHoje = pend.stream().filter(t -> t.prazo.isEqual(hoje)).toList();
        List<Tarefa> semana = pend.stream().filter(t -> t.prazo.isAfter(hoje) && !t.prazo.isAfter(hoje.plusDays(7))).toList();
        long semPrazo = c.tarefas().stream().filter(t -> t.status != StatusTarefa.CONCLUIDA && t.prazo == null).count();
        if (atrasadas.isEmpty() && deHoje.isEmpty() && semana.isEmpty())
            return new Resposta("Nada atrasado e nenhum prazo nos próximos 7 dias." + (semPrazo > 0 ? " " + plural(semPrazo, "tarefa pendente está", "tarefas pendentes estão") + " sem prazo." : ""), List.of());
        StringBuilder sb = new StringBuilder();
        grupo(sb, "Atrasadas", atrasadas, hoje);
        grupo(sb, "Vencem hoje", deHoje, hoje);
        grupo(sb, "Próximos 7 dias", semana, hoje);
        String texto = sb.toString().strip();
        if (semPrazo > 0) texto += "\n\n" + plural(semPrazo, "tarefa pendente está", "tarefas pendentes estão") + " sem prazo.";
        if (!atrasadas.isEmpty()) texto += (semPrazo > 0 ? "\n" : "\n\n") + "Comece pelas atrasadas ou ajuste o prazo delas no detalhe da tarefa.";
        List<Long> ordem = new ArrayList<>(); atrasadas.forEach(t -> ordem.add(t.id)); deHoje.forEach(t -> ordem.add(t.id));
        return new Resposta(texto, ordem);
    }

    private static void grupo(StringBuilder sb, String titulo, List<Tarefa> ts, LocalDate hoje) {
        if (ts.isEmpty()) return;
        sb.append(titulo).append(" (").append(ts.size()).append("):");
        for (Tarefa t : ts.subList(0, Math.min(5, ts.size()))) {
            long d = ChronoUnit.DAYS.between(hoje, t.prazo);
            sb.append("\n• \"").append(t.titulo).append("\"")
              .append(d < 0 ? ", há " + plural(-d, "dia", "dias") : d == 0 ? "" : ", " + diaSemana(t.prazo) + " " + t.prazo.format(DATA))
              .append(t.prioridade == Prioridade.ALTA ? ", prioridade alta" : "");
        }
        if (ts.size() > 5) sb.append("\n• e mais ").append(ts.size() - 5);
        sb.append("\n\n");
    }

    private static Resposta carga(Contexto c, List<Avaliada> fila) {
        if (fila.isEmpty()) return new Resposta("Sem tarefas pendentes: sua carga está zerada.", List.of());
        LocalDate limite = c.hoje().plusDays(7);
        double totalH = 0, semanaH = 0; int semEstimativa = 0, naSemana = 0;
        for (Avaliada a : fila) {
            Double h = horas(a.t());
            boolean daSemana = a.t().prazo != null && !a.t().prazo.isAfter(limite);
            if (daSemana) naSemana++;
            if (h == null) { semEstimativa++; continue; }
            totalH += h;
            if (daSemana) semanaH += h;
        }
        StringBuilder sb = new StringBuilder("Pendentes: ").append(plural(fila.size(), "tarefa", "tarefas")).append(", ").append(fmtHoras(totalH)).append(" estimadas no total");
        if (semEstimativa > 0) sb.append(" (").append(plural(semEstimativa, "sem estimativa", "sem estimativa")).append(')');
        sb.append(".\nCom prazo até ").append(limite.format(DATA)).append(" (inclui atrasadas): ").append(plural(naSemana, "tarefa", "tarefas")).append(", ").append(fmtHoras(semanaH)).append('.');
        double focoH = c.focoSemanaSeg() / 3600.0;
        if (c.focoSemanaSeg() <= 0) {
            sb.append("\nAinda não há sessões de foco nos últimos 7 dias para comparar com o seu ritmo. Use \"Planejar\" na faixa do painel informando as horas que você tem na semana.");
        } else {
            double porDia = focoH / 7;
            sb.append("\nNos últimos 7 dias você focou ").append(fmtHoras(focoH)).append(" (média de ").append(fmtHoras(porDia)).append(" por dia).");
            if (semanaH > 0) {
                long diasNecessarios = (long) Math.ceil(semanaH / porDia);
                sb.append(" No seu ritmo atual, as tarefas da semana levariam cerca de ").append(plural(diasNecessarios, "dia", "dias")).append('.');
                if (diasNecessarios > 7) {
                    List<String> adiar = fila.stream().filter(a -> a.t().prioridade == Prioridade.BAIXA && a.t().prazo != null && !a.t().prazo.isAfter(limite))
                        .map(a -> "\"" + a.t().titulo + "\"").limit(3).toList();
                    sb.append("\nNão cabe na semana. ").append(adiar.isEmpty() ? "Reveja prazos ou aumente o tempo de foco diário." : "Candidatas a adiar (prioridade baixa): " + String.join(", ", adiar) + ".");
                } else sb.append(" Cabe, se o ritmo se mantiver.");
            }
        }
        return new Resposta(sb.toString(), List.of());
    }

    private static Resposta resumo(Contexto c, List<Avaliada> fila) {
        long fazer = c.tarefas().stream().filter(t -> t.status == StatusTarefa.BACKLOG).count();
        long andamento = c.tarefas().stream().filter(t -> t.status == StatusTarefa.EM_ANDAMENTO).count();
        LocalDate inicio = c.hoje().minusDays(6);
        long concluidasSemana = c.tarefas().stream().filter(t -> t.status == StatusTarefa.CONCLUIDA && t.concluidaEm != null
            && !t.concluidaEm.atZone(FUSO).toLocalDate().isBefore(inicio)).count();
        long atrasadas = fila.stream().filter(a -> a.t().prazo != null && a.t().prazo.isBefore(c.hoje())).count();
        StringBuilder sb = new StringBuilder("Resumo dos últimos 7 dias:\n");
        sb.append("• Foco: ").append(fmtSeg(c.focoSemanaSeg())).append(" em ").append(plural(c.sessoesSemana(), "sessão", "sessões")).append(" (hoje: ").append(fmtSeg(c.focoHojeSeg())).append(")\n");
        sb.append("• Concluídas: ").append(concluidasSemana).append('\n');
        sb.append("• Quadro agora: ").append(fazer).append(" a fazer, ").append(andamento).append(" em andamento");
        if (atrasadas > 0) sb.append(", ").append(plural(atrasadas, "atrasada", "atrasadas"));
        c.focoPorTarefaSeg().entrySet().stream().max(Map.Entry.comparingByValue()).ifPresent(e ->
            c.tarefas().stream().filter(t -> Objects.equals(t.id, e.getKey())).findFirst().ifPresent(t ->
                sb.append("\n• Tarefa com mais foco acumulado: \"").append(t.titulo).append("\" (").append(fmtSeg(e.getValue())).append(')')));
        if (c.focoSemanaSeg() == 0 && concluidasSemana == 0) sb.append("\n\nSemana ainda sem registro. Uma sessão curta de Pomodoro já começa a contar.");
        else if (atrasadas > 0) sb.append("\n\nPonto de atenção: ").append(plural(atrasadas, "tarefa atrasada", "tarefas atrasadas")).append(". Pergunte \"o que está atrasado?\" para ver a lista.");
        return new Resposta(sb.toString(), List.of());
    }

    private static Resposta modo(String norm, Tarefa citada, List<Avaliada> fila, Contexto c) {
        if (c.modos().isEmpty()) return new Resposta("Não encontrei modos de concentração cadastrados. Veja a tela Modos.", List.of());
        StringBuilder sb = new StringBuilder("Seus modos: ");
        sb.append(String.join(", ", c.modos().stream().map(m -> m.nome() + " (" + m.focoMin() + "/" + m.pausaMin() + " min)").toList())).append(".\n");
        boolean cansado = norm.matches(".*(cansad|exausto|sono|ansios|estress).*");
        Modo relax = modoPorNome(c, "relax");
        if (cansado && relax != null) sb.append("Para agora, Relax: ciclos mais curtos e pausa maior ajudam quando a energia está baixa.");
        else if (citada != null) sb.append(modoPara(citada, c, true));
        else if (!fila.isEmpty()) sb.append(modoPara(fila.get(0).t(), c, true));
        else sb.append("Sem tarefas pendentes, comece pelo Pomodoro: é o mais equilibrado para criar o hábito.");
        return new Resposta(sb.toString().strip(), cansado ? List.of() : citada != null ? List.of(citada.id) : fila.isEmpty() ? List.of() : List.of(fila.get(0).t().id));
    }

    /** Sugere o modo pela estimativa da tarefa: ≥ 2h pede blocos longos (Profundo); o resto vai bem com Pomodoro. */
    private static String modoPara(Tarefa t, Contexto c, boolean sempre) {
        Double h = horas(t);
        Modo profundo = modoPorNome(c, "profundo"), pomodoro = modoPorNome(c, "pomodoro");
        if (h != null && h >= 2 && profundo != null)
            return "Modo sugerido para \"" + t.titulo + "\": " + profundo.nome() + " (" + profundo.focoMin() + "/" + profundo.pausaMin() + " min), porque são " + fmtHoras(h) + " estimadas: blocos longos rendem mais. São cerca de " + (int) Math.ceil(h * 60 / profundo.focoMin()) + " blocos.";
        if (pomodoro != null && (sempre || h != null))
            return "Modo sugerido para \"" + t.titulo + "\": " + pomodoro.nome() + " (" + pomodoro.focoMin() + "/" + pomodoro.pausaMin() + " min)"
                + (h != null ? ", cerca de " + plural((long) Math.ceil(h * 60 / pomodoro.focoMin()), "bloco", "blocos") + "." : ".");
        return null;
    }

    private static Resposta dividir(Tarefa citada, List<Avaliada> fila, Contexto c) {
        if (fila.isEmpty() && citada == null) return new Resposta(SEM_TAREFAS, List.of());
        Tarefa alvo = citada != null ? citada : fila.stream().map(Avaliada::t).filter(t -> t.horasEstimadas != null)
            .max(Comparator.comparing((Tarefa t) -> t.horasEstimadas)).orElse(fila.get(0).t());
        StringBuilder sb = new StringBuilder("Para \"").append(alvo.titulo).append("\"");
        Double h = horas(alvo);
        if (h != null) sb.append(" (").append(fmtHoras(h)).append(" estimadas)");
        sb.append(":\n1. Escreva em uma frase o que significa \"pronto\" para esta tarefa.\n")
          .append("2. Quebre em 3 a 5 partes de até 1 hora e cadastre cada uma no quadro.\n")
          .append("3. Comece pela parte mais simples: o difícil costuma ser só começar.\n")
          .append("4. No fim de cada bloco, anote onde parou para retomar sem esforço.");
        String modo = modoPara(alvo, c, true);
        if (modo != null) sb.append("\n\n").append(modo);
        return new Resposta(sb.toString(), List.of(alvo.id));
    }

    private static Resposta dicas(String norm, List<Avaliada> fila, Contexto c) {
        StringBuilder sb = new StringBuilder();
        Avaliada sugestao = fila.isEmpty() ? null : fila.get(0);
        if (norm.matches(".*(cansad|exausto|sono).*")) {
            sb.append("Com pouca energia:\n• Faça uma pausa curta antes, longe da tela, e beba água.\n• Use o modo Relax: ciclos curtos e pausas maiores.\n• Escolha algo leve agora e deixe o pesado para quando render mais.");
            sugestao = fila.stream().filter(a -> horas(a.t()) != null && horas(a.t()) <= 1).findFirst().orElse(sugestao);
        } else if (norm.matches(".*(ansios|estress|sobrecarreg).*")) {
            sb.append("Quando tudo parece urgente:\n• Olhe só para a próxima tarefa, não para a lista inteira.\n• Quebre a primeira em um passo de 25 minutos.\n• Pergunte \"vai dar tempo esta semana?\" para ver se a carga cabe de verdade.");
        } else if (norm.matches(".*(distra|concentr|sem foco|perdendo o foco).*")) {
            sb.append("Para proteger o foco:\n• Silencie notificações e deixe só a aba da tarefa aberta.\n• O modo Profundo esconde avisos durante a sessão.\n• Anote em papel o pensamento que aparecer e volte para a tarefa.");
        } else if (norm.contains("motiva")) {
            long concl = c.tarefas().stream().filter(t -> t.status == StatusTarefa.CONCLUIDA && t.concluidaEm != null
                && !t.concluidaEm.atZone(FUSO).toLocalDate().isBefore(c.hoje().minusDays(6))).count();
            sb.append(concl > 0 ? "Você já concluiu " + plural(concl, "tarefa", "tarefas") + " nos últimos 7 dias" + (c.focoSemanaSeg() > 0 ? " e focou " + fmtSeg(c.focoSemanaSeg()) : "") + ". Isso conta.\n" : "")
              .append("• Comece por algo pequeno: terminar uma tarefa rápida dá impulso para a próxima.\n• Marque como concluída assim que terminar: ver o quadro andar ajuda.");
            sugestao = fila.stream().filter(a -> horas(a.t()) != null && horas(a.t()) <= 1).findFirst().orElse(sugestao);
        } else {   // procrastinação, preguiça, travado, "não consigo"
            sb.append("Para destravar:\n• Combine com você mesmo só 5 minutos; parar depois é permitido.\n• Comece pela parte mais fácil da tarefa.\n• Inicie a sessão de foco antes de se sentir pronto: a vontade vem com o movimento.");
            sugestao = fila.stream().filter(a -> horas(a.t()) != null && horas(a.t()) <= 1).findFirst().orElse(sugestao);
        }
        if (sugestao != null) sb.append("\n\nSugestão para agora: ").append(linha(sugestao)).append('.');
        return new Resposta(sb.toString(), sugestao == null ? List.of() : List.of(sugestao.t().id));
    }

    private static Resposta concluiu(Tarefa citada, List<Avaliada> fila) {
        StringBuilder sb = new StringBuilder("Boa!");
        if (citada != null && citada.status != StatusTarefa.CONCLUIDA)
            sb.append(" \"").append(citada.titulo).append("\" ainda aparece como ").append(rotuloStatus(citada.status))
              .append(" no quadro: marque como concluída (botão ✓ do cartão) para entrar no histórico e nas métricas.");
        else if (citada == null) sb.append(" Se ainda não marcou, use o botão ✓ do cartão para a tarefa entrar no histórico e nas métricas.");
        List<Avaliada> resto = fila.stream().filter(a -> citada == null || !Objects.equals(a.t().id, citada.id)).toList();
        if (!resto.isEmpty()) sb.append("\nPróxima sugestão: ").append(linha(resto.get(0))).append('.');
        else sb.append("\nNão sobrou nada pendente. Bom trabalho.");
        return new Resposta(sb.toString(), resto.isEmpty() ? List.of() : List.of(resto.get(0).t().id));
    }

    private static Resposta tarefa(Tarefa t, List<Avaliada> fila, Contexto c) {
        StringBuilder sb = new StringBuilder("\"").append(t.titulo).append("\": ").append(rotuloStatus(t.status))
            .append(", prioridade ").append(rotulo(t.prioridade));
        if (t.prazo != null) {
            long d = ChronoUnit.DAYS.between(c.hoje(), t.prazo);
            sb.append(d < 0 ? ", atrasada há " + plural(-d, "dia", "dias") : d == 0 ? ", vence hoje" : ", prazo " + diaSemana(t.prazo) + " " + t.prazo.format(DATA));
        } else sb.append(", sem prazo");
        Double h = horas(t);
        sb.append(h != null ? ", " + fmtHoras(h) + " estimadas" : ", sem estimativa").append('.');
        Long foco = c.focoPorTarefaSeg().get(t.id);
        sb.append(foco != null && foco > 0 ? "\nFoco já registrado nela: " + fmtSeg(foco) + "." : "\nAinda sem sessão de foco registrada nela.");
        if (t.status == StatusTarefa.CONCLUIDA) return new Resposta(sb.append("\nJá está concluída.").toString(), List.of());
        for (int k = 0; k < fila.size(); k++) if (Objects.equals(fila.get(k).t().id, t.id)) {
            sb.append("\nNa fila de prioridade ela está em ").append(k + 1).append("º de ").append(fila.size()).append('.');
            if (k > 0) sb.append(" Antes dela: ").append(linha(fila.get(0))).append('.');
            break;
        }
        String modo = modoPara(t, c, false);
        if (modo != null) sb.append('\n').append(modo);
        return new Resposta(sb.toString(), List.of(t.id));
    }

    private static Resposta desconhecida(List<Avaliada> fila) {
        StringBuilder sb = new StringBuilder("Não tenho certeza do que você quis dizer. Sem uma IA generativa conectada, eu respondo sobre suas tarefas, prazos, tempo de foco e modos. Pergunte \"ajuda\" para ver exemplos.");
        if (!fila.isEmpty()) sb.append("\n\nEnquanto isso, a próxima tarefa sugerida é ").append(linha(fila.get(0))).append('.');
        return new Resposta(sb.toString(), fila.isEmpty() ? List.of() : List.of(fila.get(0).t().id));
    }

    // ---------- formatação ----------

    private static String linha(Avaliada a) {
        return "\"" + a.t().titulo + "\"" + (a.motivos().isEmpty() ? "" : " (" + String.join(", ", a.motivos()) + ")");
    }
    private static List<Long> ids(List<Avaliada> as) { return as.stream().map(a -> a.t().id).toList(); }
    private static Double horas(Tarefa t) { return t.horasEstimadas == null ? null : t.horasEstimadas.doubleValue(); }
    private static Modo modoPorNome(Contexto c, String inicio) {
        return c.modos().stream().filter(m -> normalizar(m.nome()).startsWith(inicio)).findFirst().orElse(null);
    }
    static String plural(long n, String um, String varios) { return n + " " + (n == 1 ? um : varios); }
    private static String diaSemana(LocalDate d) {
        String s = d.getDayOfWeek().getDisplayName(TextStyle.FULL, PT).replace("-feira", "");
        return (d.getDayOfWeek() == DayOfWeek.SATURDAY || d.getDayOfWeek() == DayOfWeek.SUNDAY ? "no " : "na ") + s;
    }
    static String fmtHoras(double h) {
        if (h < 1) return fmtMin((int) Math.round(h * 60));
        double r = Math.round(h * 10) / 10.0;
        return (r == Math.floor(r) ? String.valueOf((long) r) : String.valueOf(r).replace('.', ',')) + "h";
    }
    static String fmtMin(int min) { return min < 60 ? min + " min" : (min % 60 == 0 ? (min / 60) + "h" : (min / 60) + "h" + String.format("%02d", min % 60)); }
    static String fmtSeg(long seg) { return seg < 60 ? (seg == 0 ? "0 min" : "menos de 1 min") : fmtMin((int) (seg / 60)); }
    private static String rotulo(Prioridade p) { return p == Prioridade.ALTA ? "alta" : p == Prioridade.MEDIA ? "média" : "baixa"; }
    private static String rotuloStatus(StatusTarefa s) { return s == StatusTarefa.BACKLOG ? "a fazer" : s == StatusTarefa.EM_ANDAMENTO ? "em andamento" : "concluída"; }
}
