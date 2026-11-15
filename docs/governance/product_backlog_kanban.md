# Product Backlog, User Stories (Gherkin) e Plano de Releases

**Projeto:** CaseTrack (Chave no Jira: `SCRUM`)  
**Autor:** Douglas Alexandre Marchesi

---

## 1. Padrão de Versionamento (SemVer) e Planejamento de Releases

O projeto adota o **Versionamento Semântico (`MAJOR.MINOR.PATCH`)**:
* **MAJOR (`1.x.x`):** Versão completa com arquitetura validada, cache distribuído, mensageria e documentação fechada.
* **MINOR (`0.8.x`):** Adição de novas funcionalidades retrocompatíveis (ex.: módulo Redis, novo endpoint de confirmação ou integração Google Calendar).
* **PATCH (`0.8.1`):** Correções de bugs, ajustes de lint ou melhorias de configuração sem alterar contratos da API.

### Cronograma de Lançamentos Parciais (Sprints / Releases)
| Release / Tag | Sprint | Foco da Entrega | Principais Entregáveis |
| :--- | :--- | :--- | :--- |
| **`v0.8.0-alpha`** | Sprint 1 | Infraestrutura e Cache/Pub-Sub | Docker Compose com isolamento de rede, Proxy Reverso Nginx, container Redis 7, `CacheInterceptor` (TTL + invalidação `O(1)`) e `HttpExceptionFilter`. |
| **`v0.8.0-beta`** | Sprint 2 | Domínio DDD, Concorrência e Resiliência | `ProductionAggregate`, Value Objects (`ProductionPeriod`, `ProductionStageVO`), lock pessimista (`FOR UPDATE`), publicação pós-commit no canal `casetrack:events`, Circuit Breaker `opossum` e testes unitários. |
| **`v1.0.0`** | Sprint 3 | Documentação, CI/CD e Governança | Diagramas C4, Context Map, ADRs 001 a 003, especificação OpenAPI 3.0, workflow GitHub Actions (`.github/workflows/ci-cd.yml`), Runbook e documentação ágil. |

---

## 2. Product Backlog Priorizado (Método MoSCoW)

Priorização baseada em valor de negócio e redução de risco técnico:
* **Must Have (Obrigatório):** Essencial para o funcionamento seguro e escalável do sistema.
* **Should Have (Importante):** Agrega resiliência e automação operacional relevante.
* **Could Have (Desejável):** Melhorias complementares de integração e experiência.

| ID Jira | Tipo | Épico Relacionado | Título do Item de Backlog | Prioridade (MoSCoW) | Estimativa (Story Points) | Release Alvo |
| :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| **SCRUM-28** | Epic | Infraestrutura | Infraestrutura Docker, Proxy Reverso Nginx e Isolamento de Rede | Must Have | - | `v0.8.0-alpha` |
| **SCRUM-29** | Epic | Performance & Eventos | Cache Distribuído (Cache-Aside) e Mensageria Pub/Sub com Redis | Must Have | - | `v0.8.0-alpha` |
| **SCRUM-30** | Epic | Core Domain (DDD) | Modelagem DDD, Concorrência no MySQL e Ciclo de Produções | Must Have | - | `v0.8.0-beta` |
| **SCRUM-31** | Epic | Resiliência & DevOps | Documentação Arquitetural, Pipeline CI/CD, Runbook e Governança | Should Have | - | `v1.0.0` |
| **SCRUM-32** | História | SCRUM-28 | Roteamento seguro via Nginx Reverse Proxy e proteção das portas internas | Must Have | 5 SP | `v0.8.0-alpha` |
| **SCRUM-33** | História | SCRUM-29 | Consulta rápida de equipamentos e produções com Cache-Aside e TTL | Must Have | 8 SP | `v0.8.0-alpha` |
| **SCRUM-34** | História | SCRUM-29 | Invalidação automática de cache ao cadastrar ou atualizar registros | Must Have | 5 SP | `v0.8.0-alpha` |
| **SCRUM-35** | História | SCRUM-30 | Confirmação de produção sem conflito de horário (*anti double-booking*) | Must Have | 8 SP | `v0.8.0-beta` |
| **SCRUM-36** | História | SCRUM-29 | Notificação assíncrona via Redis Pub/Sub ao confirmar uma produção | Must Have | 5 SP | `v0.8.0-beta` |
| **SCRUM-37** | História | SCRUM-31 | Sincronização com Google Calendar protegida por Circuit Breaker | Should Have | 5 SP | `v0.8.0-beta` |

---

## 3. Detalhamento das User Stories e Critérios de Aceite (Gherkin)

### US01 (SCRUM-32) - Gateway Único com Nginx Reverse Proxy
* **História:** *Como* administrador de infraestrutura, *eu quero* que todo o tráfego HTTP externo passe exclusivamente pelo Nginx na porta 80, *para que* a API NestJS e o Redis fiquem isolados na rede interna e protegidos contra acessos diretos e uploads excessivos.
* **Critérios de Aceite (Gherkin):**
  ```gherkin
  Funcionalidade: Isolamento de rede e roteamento via Proxy Reverso Nginx

    Cenário: Encaminhamento de requisição válida pela porta 80
      Dado que os containers nginx, api, mysqldb e redis estão em execução na rede techacademy-network
      Quando o cliente envia uma requisição GET para "http://localhost/api/v1/equipments"
      Então o Nginx deve repassar a chamada para "http://api:3000/api/v1/equipments"
      E incluir os cabeçalhos "X-Real-IP" e "X-Forwarded-For"

    Cenário: Bloqueio de acesso direto à porta interna da API no host
      Dado que o serviço api está configurado apenas com a diretiva "expose: 3000" no docker-compose.yml
      Quando um cliente externo tenta conectar diretamente na porta 3000 do host
      Então a conexão deve ser recusada pela ausência de mapeamento público de porta
  ```

---

### US02 (SCRUM-33) - Aceleração de Listagens com Cache-Aside e TTL
* **História:** *Como* produtor ou freelancer, *eu quero* que as listagens de equipamentos e produções respondam rapidamente usando cache em memória, *para que* a navegação no aplicativo continue ágil mesmo com vários usuários simultâneos.
* **Critérios de Aceite (Gherkin):**
  ```gherkin
  Funcionalidade: Leitura acelerada com Redis Cache-Aside e TTL de 60 segundos

    Cenário: Primeira leitura consulta o banco e popula o cache (Cache MISS)
      Dado que não existe cache salvo para a consulta "GET /api/v1/equipments?skip=0&take=10" na época atual
      Quando o usuário autenticado solicita a listagem de equipamentos
      Então a API consulta o banco MySQL e salva o resultado no Redis com TTL de 60 segundos
      E retorna status 200 com o cabeçalho "X-Cache: MISS"
      E registra no log "[CACHE MISS] Chave ausente no Redis"

    Cenário: Segunda leitura idêntica dentro do TTL retorna direto do Redis (Cache HIT)
      Dado que a consulta "GET /api/v1/equipments?skip=0&take=10" já está armazenada no Redis dentro do TTL de 60s
      Quando o usuário realiza a mesma requisição novamente
      Então a API retorna os dados diretamente do Redis sem consultar o MySQL
      E retorna status 200 com o cabeçalho "X-Cache: HIT"
      E registra no log "[CACHE HIT] Chave encontrada no Redis"
  ```

---

### US03 (SCRUM-34) - Invalidação Automática de Cache em Mutações
* **História:** *Como* gestor de inventário (`ADMIN`), *eu quero* que o cache seja invalidado automaticamente sempre que eu criar, editar ou remover um equipamento ou produção, *para que* a equipe nunca visualize dados desatualizados na listagem.
* **Critérios de Aceite (Gherkin):**
  ```gherkin
  Funcionalidade: Invalidação atômica de cache por incremento de época

    Cenário: Cadastro de novo equipamento invalida o cache da listagem
      Dado que a listagem de equipamentos está em cache na época 1 ("epoch:equipments = 1")
      Quando o administrador cadastra um novo equipamento via "POST /api/v1/equipments"
      Então o sistema incrementa a versão no Redis para "epoch:equipments = 2"
      E na próxima chamada "GET /api/v1/equipments" a resposta vem atualizada do banco com "X-Cache: MISS"
  ```

---

### US04 (SCRUM-35) - Reserva de Equipamentos sem Conflito de Horário
* **História:** *Como* produtor audiovisual (`ADMIN`), *eu quero* que o sistema valide e bloqueie conflitos de agenda ao confirmar uma produção, *para que* um mesmo equipamento nunca seja reservado para duas gravações no mesmo período.
* **Critérios de Aceite (Gherkin):**
  ```gherkin
  Funcionalidade: Prevenção de double-booking com lock pessimista na confirmação

    Cenário: Bloqueio de confirmação quando há equipamento alocado em horário sobreposto
      Dado que a câmera "Sony FX6" já está reservada em uma produção ativa das 08:00 às 18:00 do dia 20/11/2026
      Quando um administrador tenta confirmar outra produção com a mesma câmera das 14:00 às 20:00 do dia 20/11/2026
      Então o sistema adquire o lock "SELECT ... FOR UPDATE" no MySQL e identifica a sobreposição de datas
      E desfaz a transação retornando status "409 Conflict" com a lista de equipamentos conflitantes
  ```

---

### US05 (SCRUM-36) - Publicação e Consumo de Eventos via Redis Pub/Sub
* **História:** *Como* arquiteto do sistema, *eu quero* que a confirmação de uma produção publique um evento assíncrono no Redis após o commit no banco, *para que* o histórico de auditoria e os consumidores de eventos processem a confirmação de forma desacoplada.
* **Critérios de Aceite (Gherkin):**
  ```gherkin
  Funcionalidade: Mensageria assíncrona pós-commit no canal casetrack:events

    Cenário: Disparo e recebimento de evento após confirmação de produção
      Dado que uma produção válida em rascunho possui equipamentos disponíveis alocados
      Quando o administrador executa "PATCH /api/v1/productions/:id/confirm"
      Então a transação atualiza o status no MySQL, grava o registro em "event_audit_log" e executa o COMMIT
      E em seguida o RedisService publica o evento "ProductionConfirmedEvent" no canal "casetrack:events"
      E o console registra "[PUB/SUB PUBLISH] Evento enviado ao canal casetrack:events"
      E o EventsSubscriber recebe a mensagem registrando "[PUB/SUB SUBSCRIBE] Evento recebido no canal casetrack:events"
  ```

---

### US06 (SCRUM-37) - Degradação Graciosa com Circuit Breaker no Google Calendar
* **História:** *Como* produtor audiovisual, *eu quero* que falhas ou lentidão na API do Google Calendar sejam isoladas por um Circuit Breaker, *para que* o CaseTrack continue funcionando sem erros 500 caso o serviço externo do Google saia do ar.
* **Critérios de Aceite (Gherkin):**
  ```gherkin
  Funcionalidade: Proteção da integração externa com Circuit Breaker (opossum)

    Cenário: Ativação de fallback quando a API do Google excede o tempo limite
      Dado que a integração com o Google Calendar está com tempo de resposta superior a 3000ms ou taxa de falha >= 50%
      Quando o administrador solicita a sincronização em "POST /api/v1/productions/:id/sync-google"
      Então o Circuit Breaker abre o circuito e interrompe novas chamadas externas por 30 segundos
      E retorna status 200 com "{ calendarSynced: false, warning: 'Agenda externa temporariamente indisponível (Circuit Breaker ativo)' }"
  ```
