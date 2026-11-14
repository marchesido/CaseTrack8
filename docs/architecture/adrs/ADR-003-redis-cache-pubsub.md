# ADR 003: Uso do Redis para Cache-Aside (Invalidação por Época) e Pub/Sub

* **Status:** Aceito
* **Data:** 08/11/2026
* **Autor:** Douglas Alexandre Marchesi

---

## Contexto

Para reduzir as consultas diretas ao MySQL e desacoplar a emissão de eventos na API, precisamos implementar:
1. **Cache de leitura** nas listagens de equipamentos e produções com expiração (TTL) e limpeza automática sempre que houver cadastro, edição ou exclusão.
2. **Mensageria assíncrona** para publicar eventos de domínio (como a confirmação de uma produção) e consumi-los em background com registro em log.

Um problema comum ao invalidar cache de rotas com filtros (`?skip=0&take=10`, `?status=...`) é o uso do comando `KEYS *`, que tem custo `O(N)` e trava o Redis quando há muitas chaves.

---

## Opções Consideradas

### 1. Invalidar Cache com `KEYS` + `DEL` e usar RabbitMQ/Kafka para Eventos
* **Vantagens:** Brokers dedicados possuem filas persistentes robustas.
* **Desvantagens:** Subir RabbitMQ ou Kafka adiciona consumo desnecessário de memória para o porte do projeto, já que o Redis possui suporte nativo a Pub/Sub. Além disso, usar `KEYS` no Redis degrada a performance.

### 2. Redis para Cache-Aside com Versionamento de Época (`O(1)`) e Redis Pub/Sub (Escolhida)
* **Como funciona o cache:**
  * Cada módulo possui um contador de versão (época) no Redis, ex.: `epoch:equipments = 1`.
  * A chave de cache combina o nome do módulo, a época atual e o hash SHA-256 dos query params ordenados: `cache:equipments:v1:<hash>`.
  * Quando ocorre um `POST`, `PATCH` ou `DELETE`, o sistema apenas executa `INCR epoch:equipments` (custo `O(1)`). Na leitura seguinte, a API passa a buscar chaves `:v2:`, ignorando as antigas (que expiram sozinhas pelo TTL de 60s ou pela política `volatile-lru`).
* **Como funciona o Pub/Sub:**
  * O `RedisModule` cria 3 conexões `ioredis` separadas (`CACHE`, `PUBLISHER` e `SUBSCRIBER`), pois o cliente em modo `SUBSCRIBE` fica dedicado a escutar o canal.
  * Após o `COMMIT` da confirmação de produção no MySQL, o `ProductionsService` publica o evento no canal `casetrack:events`, que é lido pelo `EventsSubscriber`.

---

## Decisão

Adotar o **Redis 7** tanto para o padrão **Cache-Aside** (com TTL de 60s e invalidação `O(1)` por incremento de época) quanto para a mensageria **Pub/Sub** no canal `casetrack:events`.

---

## Consequências

* **Positivas:**
  * Invalidação rápida e segura sem usar `KEYS`.
  * Caso o container do Redis caia, o `RedisService` trata o erro e a API continua funcionando normalmente consultando o MySQL (fallback).
  * Logs claros no console (`[CACHE HIT]`, `[CACHE MISS]`, `[PUB/SUB PUBLISH]` e `[PUB/SUB SUBSCRIBE]`) facilitando a verificação.
* **Negativas / Cuidados:**
  * Chaves de épocas anteriores continuam ocupando memória até o TTL vencer; por isso o Redis foi configurado com limite `--maxmemory 256mb --maxmemory-policy volatile-lru`.
