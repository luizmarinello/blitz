-- RNF07: texto em pt-BR correto no modo predefinido (o V1 gravou "concentracao" sem cedilha). Só dado, nenhum objeto do schema muda.
UPDATE modo_concentracao SET descricao = 'Bloco longo de concentração intensa, com pausa reduzida.'
 WHERE predefinido AND nome = 'Profundo';
