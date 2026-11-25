# Central de Comunicações BVA

Versão instalável 0.4.3 do dashboard. Renderiza o ecrã e o backoffice através do shortcode `[bva_central]` e guarda os registos numa tabela própria da base de dados WordPress. O backoffice inclui também a gestão das listas de hospitais e serviços.

A versão 0.4.3 identifica o Comando Sub Regional de Lisboa no estado de prontidão e permite introduzir início e fim tanto em data/hora normal como em grupo data hora, com conversão automática. Ambos os formatos permanecem visíveis no dashboard durante a validade do estado.

A versão 0.4.2 corrige a apresentação de constrangimentos hospitalares e avisos que eram guardados, mas não apareciam nas listas. Uniformiza ainda a tipografia e aumenta a legibilidade da prontidão e da meteorologia.

## Instalação

1. No WordPress, abre **Plugins → Adicionar novo → Carregar plugin** e carrega o ZIP `bva-central-comunicacoes.zip`.
2. Ativa **Central de Comunicações BVA**.
3. Cria uma página WordPress para a Central e insere `[bva_central]` no conteúdo.
4. Os utilizadores têm de iniciar sessão no WordPress para consultar a página.
5. Para dar edição, assinala o utilizador em **Utilizadores → Acesso à Central BVA**. Os administradores também podem editar.

Todos os utilizadores WordPress autenticados com permissão de leitura podem consultar. A edição e as operações de escrita da API são verificadas no servidor. A instalação cria a tabela de dados; não introduz registos de demonstração.

## Incluído

- Dashboard vertical, agrupamento por hospital, relógio e previsão do tempo na Amadora.
- Backoffice para constrangimentos, prontidão e avisos.
- Área **Hospitais e serviços** para gerir os valores dos dropdowns. Nomes iguais ignorando maiúsculas e acentos são recusados; itens associados a constrangimentos têm de ser corrigidos antes de serem removidos.
- Área **Identidade visual** para carregar o logótipo e personalizar o título, subtítulo e cores do cabeçalho. Aceita imagens PNG, JPG ou WebP até 2 MB.
- Seletor **Texto** no dashboard com três tamanhos. A escolha fica guardada no navegador de cada dispositivo, permitindo definir um tamanho diferente no monitor, telemóvel ou tablet.
- Entrada automática dos constrangimentos uma hora antes do início e remoção da vista à hora de fim.
- Atualização dos dados através da API REST autenticada do WordPress.

O bloco meteorológico consulta Open-Meteo e necessita de ligação à Internet. A página deve ser servida por HTTPS e aberta com uma sessão WordPress iniciada.

O pacote começa sem registos. Os exemplos guardados no protótipo local do navegador não são importados para o WordPress.

## Nota

Esta versão foi preparada como experiência a instalar num WordPress de teste. Antes de a usar na Central, deve ser instalada no site de destino e verificada com as contas e o tema desse site.
