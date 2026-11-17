-- RA05 / seção 6: o tema claro (branco + azul) volta a ser o padrão. O escuro era o padrão da aplicação, não uma escolha
-- da pessoa, então quem está nele passa para o claro; quem quiser o escuro troca em um clique (barra lateral ou Acessibilidade).
-- Só dado, nenhum objeto do schema muda (o DEFAULT do V1 já é 'CLARO').
UPDATE preferencia_acessibilidade SET tema = 'CLARO' WHERE tema = 'ESCURO';
