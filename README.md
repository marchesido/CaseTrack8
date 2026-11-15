# CaseTrack - Sistema de Gestão de Equipamentos e Produções Audiovisuais

[![NestJS](https://img.shields.io/badge/Backend-NestJS%2011-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![MySQL](https://img.shields.io/badge/Database-MySQL%208.0-4479A1?logo=mysql&logoColor=white)](https://www.mysql.com/)
[![Redis](https://img.shields.io/badge/Cache%20%26%20PubSub-Redis%207-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![Nginx](https://img.shields.io/badge/Proxy-Nginx%20Alpine-009639?logo=nginx&logoColor=white)](https://nginx.org/)
[![Expo](https://img.shields.io/badge/Mobile-Expo%20SDK%2057-000020?logo=expo&logoColor=white)](https://expo.dev/)
[![Docker](https://img.shields.io/badge/Container-Docker%20Compose-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)

O **CaseTrack** é uma plataforma para gestão de produtoras audiovisuais, locadoras de equipamentos e equipes técnicas. O sistema controla o inventário de equipamentos, agendamento de produções em 4 etapas (Captação, Edição, Backup e Upload), movimentações de retirada e devolução (`checkout`/`checkin`), registro de avarias com fotos, sincronização com Google Calendar e emissão de Termos de Responsabilidade em PDF.

* **Autor:** Douglas Alexandre Marchesi
* **Repositório:** [https://github.com/marchesido/CaseTrack8](https://github.com/marchesido/CaseTrack8)

---

## Arquitetura e Stack Tecnológica

O backend opera como um **Monólito Modular** em NestJS 11 isolado na rede privada do Docker (`techacademy-network`), exposto externamente apenas pelo proxy reverso **Nginx** na porta 80.

| Camada | Tecnologia | Função no Projeto |
| :--- | :--- | :--- |
| **Proxy Reverso** | Nginx (`nginx:alpine`) | Ponto único de entrada HTTP (porta 80), roteamento reverso para a API, timeout de 60s e limite de upload de 25MB |
| **Backend API** | NestJS 11 / TypeScript | Regras de negócio (DDD), autenticação JWT/RBAC, filtro global de exceções, Circuit Breaker (`opossum`) e geração de PDF |
| **Cache & Mensageria** | Redis 7 (`redis:7-alpine`) | Cache-Aside com TTL (60s), invalidação `O(1)` por época e barramento Pub/Sub no canal `casetrack:events` |
| **Banco de Dados** | MySQL 8.0 (InnoDB) | Persistência relacional ACID, lock pessimista (`SELECT ... FOR UPDATE`) contra conflitos de reserva e trilha de auditoria |
| **Frontend Mobile** | React Native / Expo SDK 57 | Aplicativo para gestores e freelancers com suporte a câmera/galeria e tema claro/escuro |
| **CI/CD** | GitHub Actions | Pipeline automatizado de Lint, Build, Testes Unitários (Jest), Docker Build e Deploy com rollback |

---

## Documentação Técnica e Governança (`docs/`)

Toda a documentação de arquitetura, operações e gestão ágil está organizada na pasta [`docs/`](./docs):

### 1. Arquitetura de Software e DDD ([`docs/architecture/`](./docs/architecture))
* [Diagramas C4 (Nível 1 Contexto e Nível 2 Containers)](./docs/architecture/c4_model.md)
* [Modelagem DDD - Context Map, Bounded Contexts e Modelo Tático](./docs/architecture/ddd_context_map.md)
* **Registros de Decisões Arquiteturais (ADRs):**
  * [ADR-001: Adoção de Monólito Modular com Proxy Reverso Nginx](./docs/architecture/adrs/ADR-001-modular-monolith.md)
  * [ADR-002: Uso do MySQL 8.0 (Relacional) como Banco de Dados Principal](./docs/architecture/adrs/ADR-002-relational-database.md)
  * [ADR-003: Uso do Redis para Cache-Aside (Invalidação por Época) e Pub/Sub](./docs/architecture/adrs/ADR-003-redis-cache-pubsub.md)
* [Cenários de Qualidade (Quality Scenarios) e SLOs / SLIs](./docs/architecture/quality_scenarios_slos.md)
* [Estratégias de Resiliência e Plano de Observabilidade](./docs/architecture/resilience_and_observability.md)
* [Especificação OpenAPI 3.0 (`openapi.yaml`)](./docs/architecture/openapi.yaml)

### 2. Entrega Contínua e Operações ([`docs/operations/`](./docs/operations))
* [Workflow CI/CD GitHub Actions (`.github/workflows/ci-cd.yml`)](./.github/workflows/ci-cd.yml)
* [Estratégia de Deploy e Runbook de Resposta a Incidentes](./docs/operations/runbook.md)

### 3. Governança Ágil ([`docs/governance/`](./docs/governance))
* [Análise de Contexto com Framework Cynefin e Metodologia Ágil](./docs/governance/cynefin_framework.md)
* [Product Backlog, User Stories (Gherkin) e Plano de Releases (SemVer)](./docs/governance/product_backlog_kanban.md)
* [Estruturação de Issues e Relatório de Acompanhamento no Jira](./docs/governance/jira_evidence_report.md)

---

## Como Executar o Projeto

### 1. Subir a Infraestrutura Completa com Docker Compose (Recomendado)
Na raiz do projeto, execute:

```bash
docker compose up -d --build
```

Isso iniciará os 4 containers na rede `techacademy-network`:
* **`casetrack_nginx`**: Proxy reverso acessível em `http://localhost` (porta 80).
* **`casetrack_api`**: API NestJS (porta 3000 interna, isolada do host).
* **`casetrack_redis`**: Redis 7 com política `volatile-lru` (porta 6379 interna).
* **`casetrack_mysql`**: Banco de dados MySQL 8.0.

Para acompanhar os logs de Cache (`[CACHE HIT]` / `[CACHE MISS]`) e de Mensageria (`[PUB/SUB PUBLISH]` / `[PUB/SUB SUBSCRIBE]`):
```bash
docker compose logs -f api
```

### 2. Executar o Backend em Modo Desenvolvimento Local
```bash
cd api
cp .env.example .env
npm install
npm run migration:run
npm run seed
npm run start:dev
```
* **Swagger UI:** `http://localhost/api` (via Nginx) ou `http://localhost:3000/api` (local).

### 3. Executar os Testes Automatizados
```bash
cd api
npm test -- --coverage
```

### 4. Executar o Aplicativo Mobile (Expo)
```bash
cd mobile
npm install
npx expo start -c
```

---

## Contas de Teste (Seed)

| Perfil | E-mail | Senha | Permissões |
| :--- | :--- | :--- | :--- |
| **Administrador (`ADMIN`)** | `admin@example.com` | `admin123` | Gestão de inventário, criação e confirmação de produções, substituição de equipamentos e emissão de contratos |
| **Freelancer (`FREELANCER`)** | `freelancer@example.com` | `user123` | Consulta de pendências, início/conclusão de etapas, checkout/checkin, registro de avarias e assinatura de termos |

---

## Estrutura de Pastas

```text
CaseTrack/
├── .github/workflows/          # Pipeline CI/CD (ci-cd.yml)
├── nginx/                      # Configuração do Proxy Reverso (nginx.conf)
├── docs/                       # Documentação de Arquitetura, Operações e Governança
│   ├── architecture/           # C4, DDD Context Map, ADRs 001-003, SLOs, Resiliência e OpenAPI
│   ├── operations/             # Estratégia de Deploy e Runbook de Incidentes
│   └── governance/             # Cynefin, Product Backlog Gherkin e Relatório Jira
├── api/                        # Backend NestJS 11
│   ├── src/
│   │   ├── common/             # CacheInterceptor, Decorators (@Cacheable/@InvalidateCache) e ExceptionFilter
│   │   ├── redis/              # RedisModule e RedisService (Cache-Aside O(1) e Pub/Sub)
│   │   ├── events/             # EventsSubscriber e entidade EventAuditLog
│   │   ├── productions/        # Módulo de Produções + Camada DDD (Aggregate, VOs, Mapper, ReservationPolicy)
│   │   ├── equipments/         # Inventário de equipamentos
│   │   ├── damages/            # Laudos de avarias com upload de fotos
│   │   ├── contracts/          # Geração de termos em PDF e assinatura digital
│   │   ├── auth/               # Autenticação JWT e Guards de papel
│   │   └── users/              # Gestão de usuários
├── mobile/                     # Aplicativo Mobile React Native (Expo SDK 57)
└── docker-compose.yml          # Orquestração (Nginx, API, Redis e MySQL)
```
