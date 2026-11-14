# Cenários de Qualidade (Quality Scenarios) e SLOs / SLIs

**Projeto:** CaseTrack  
**Autor:** Douglas Alexandre Marchesi

---

## 1. Cenários de Qualidade (Modelo SEI)

Mapeamento dos principais atributos de qualidade da arquitetura do CaseTrack (Fonte, Estímulo, Artefato, Ambiente, Resposta e Medida).

### Cenário 1 - Desempenho em Consultas Frequentes (Cache-Aside)
* **Atributo:** Desempenho (Latência)
* **Fonte:** Usuários (gestores e freelancers) acessando o app simultaneamente.
* **Estímulo:** 100 requisições concorrentes em `GET /api/v1/equipments` e `GET /api/v1/productions`.
* **Artefato:** Nginx + `CacheInterceptor` (NestJS) + Redis.
* **Ambiente:** Operação normal com dados já carregados em cache (TTL de 60s).
* **Resposta:** O interceptor calcula o hash da query na época atual, encontra o registro no Redis sem consultar o MySQL e devolve a resposta com o header `X-Cache: HIT`.
* **Medida:** Latência **p95 < 50ms** nas leituras em cache (e **p95 < 200ms** no geral), com taxa de acerto (Cache Hit) acima de **80%**.

### Cenário 2 - Disponibilidade em Caso de Queda do Redis (Fallback)
* **Atributo:** Disponibilidade / Tolerância a Falhas
* **Fonte:** Falha interna ou parada do container `redis`.
* **Estímulo:** Requisições de listagem (`GET /api/v1/productions`) chegam na API enquanto o Redis está fora do ar.
* **Artefato:** `RedisService` e `CacheInterceptor`.
* **Ambiente:** Operação degradada (Redis inacessível).
* **Resposta:** O `RedisService` captura o erro de conexão no `try/catch`, registra um aviso (`WARN`) no log e libera o interceptor para buscar os dados diretamente no MySQL.
* **Medida:** **Zero erros HTTP 500** para o cliente final e tempo de resposta **p95 < 500ms** lendo do MySQL.

### Cenário 3 - Consistência na Reserva de Equipamentos (Concorrência)
* **Atributo:** Consistência e Integridade de Dados
* **Fonte:** Dois administradores tentando confirmar duas produções diferentes que usam o mesmo equipamento no mesmo horário.
* **Estímulo:** Duas chamadas simultâneas para `PATCH /api/v1/productions/:id/confirm`.
* **Artefato:** `ProductionsService`, `EquipmentReservationPolicyService` e MySQL 8.0.
* **Ambiente:** Operação normal com concorrência de escrita.
* **Resposta:** A primeira transação aplica `SELECT ... FOR UPDATE` nos equipamentos, valida a disponibilidade, confirma a produção e faz o commit. A segunda transação aguarda o lock, identifica o conflito de horário e aborta com `HTTP 409 Conflict`.
* **Medida:** **0% de agendamentos duplicados (*double-booking*)** e ausência de *deadlocks* (os IDs são ordenados antes do lock).

### Cenário 4 - Resiliência na Integração Externa (Circuit Breaker)
* **Atributo:** Resiliência
* **Fonte:** API externa do Google Calendar lenta (`> 3s`) ou fora do ar (`503`).
* **Estímulo:** Chamadas para sincronizar agenda (`POST /api/v1/productions/:id/sync-google`).
* **Artefato:** `GoogleCalendarService` com `opossum`.
* **Ambiente:** Instabilidade no provedor externo.
* **Resposta:** Ao atingir 50% de falhas ou timeout de 3 segundos, o Circuit Breaker abre por 30 segundos e responde imediatamente pelo fallback (`{ calendarSynced: false, warning: ... }`), sem travar a API do CaseTrack.
* **Medida:** Resposta de fallback em **< 15ms** enquanto o circuito estiver aberto.

---

## 2. Indicadores (SLIs) e Metas de Nível de Serviço (SLOs)

| Indicador (SLI) | Meta (SLO) | Como é medido / acompanhado |
| :--- | :--- | :--- |
| **Latência de Leitura (com cache)** | **p95 < 200ms** *(Cache HIT < 50ms)* | Tempo de resposta nas rotas `GET /equipments` e `GET /productions`. |
| **Latência de Escrita / Reserva** | **p95 < 500ms** | Tempo de resposta nas rotas `POST`, `PATCH` e confirmação de produção. |
| **Disponibilidade da API (Uptime)** | **>= 99.5% ao mês** | Respostas válidas do gateway Nginx (máx. ~3h36m de indisponibilidade/mês). |
| **Taxa de Erros Internos (5xx)** | **< 0.1%** | Proporção de respostas `HTTP 5xx` sobre o total de requisições. |
| **Taxa de Acerto de Cache (Hit Ratio)** | **>= 80%** | Proporção de respostas com header `X-Cache: HIT` em rotas cacheadas. |
