package br.com.blitz;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

/**
 * Sobe o Blitz com um PostgreSQL embutido, para quem não tem Docker à mão. Dados somem ao encerrar.
 *   cd backend && ./mvnw spring-boot:run -Dspring-boot.run.useTestClasspath=true -Dspring-boot.run.main-class=br.com.blitz.DevEmbutido
 */
public class DevEmbutido {
    public static void main(String[] args) throws IOException {
        EmbeddedPostgres pg = EmbeddedPostgres.start();
        List<String> a = new ArrayList<>(List.of(args));
        a.add("--spring.datasource.url=" + pg.getJdbcUrl("postgres", "postgres"));   // argumento vence o application.yml
        a.add("--spring.datasource.username=postgres");
        a.add("--spring.datasource.password=postgres");
        BlitzApplication.main(a.toArray(String[]::new));
    }
}
