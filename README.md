# Dashboard da Central de Comunicações — BVA

Protótipo navegável de um ecrã operacional e backoffice.

## Abrir

Abra `index.html` num navegador moderno. Use **Ecrã central** para a vista de projeção e **Backoffice** para criar, editar e apagar registos. O estado de demonstração é guardado no armazenamento local do navegador.

## Regras já representadas

- Um constrangimento hospitalar fica visível a partir de uma hora antes do início e desaparece do ecrã ao atingir a hora de fim.
- O estado de prontidão especial entra em vigor no início programado e termina automaticamente no fim. No intervalo da hora anterior, é anunciado como próximo, mantendo-se visível o estado atual.
- O ecrã e o estado dos registos são recalculados continuamente pelo relógio do navegador.
- A vista do dashboard adapta-se a monitores verticais e reúne os serviços visíveis sob um único grupo por hospital.
- O formulário de constrangimentos oferece listas de hospitais e serviços com a opção «Outro» para acrescentar valores.
- O estado de prontidão especial pode ser programado como Normal ou Nível I a IV; o dashboard aplica uma escala visual de cinzentos do branco ao preto.
- O dashboard mostra um relógio local permanente e a previsão meteorológica atual e horária das próximas três horas na Amadora, incluindo precipitação horária estimada em mm e vento em km/h, obtida através da API Open-Meteo.
- O backoffice permite gerir constrangimentos, estados de prontidão e avisos operacionais.

## Próxima fase para produção

O modelo de acesso definido é simples: os utilizadores autenticados podem consultar; a Central e os utilizadores autorizados podem editar. A Central deverá poder conceder ou retirar a permissão de edição.

O protótipo não partilha dados entre navegadores nem tem autenticação. Para utilização real, requer uma aplicação alojada com base de dados central, autenticação e perfis, registo da origem e hora de atualização. Só assim os dados introduzidos num computador aparecem no ecrã da Central e nos portáteis iTeams.

Os registos iniciais são exemplos e não devem ser usados como informação operacional.
