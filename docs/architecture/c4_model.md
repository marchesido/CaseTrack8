# Arquitetura C4 - CaseTrack

**Projeto:** CaseTrack (Gestão de Equipamentos e Produções Audiovisuais)  
**Autor:** Douglas Alexandre Marchesi

---

## 1. Nível 1 - Diagrama de Contexto

Visão geral do CaseTrack, seus perfis de acesso e integrações externas.

```mermaid
flowchart TD
    UserAdmin["Gestor / Produtor (ADMIN)<br/>[Pessoa]<br/>Cadastra equipamentos, agenda produções, aprova substituições e gera contratos."]
    UserFree["Freelancer / Equipe Técnica (FREELANCER)<br/>[Pessoa]<br/>Executa etapas da produção, faz check-in/out de equipamentos, reporta avarias e assina termos."]

    System["CaseTrack<br/>[Sistema de Software]<br/>Controle de inventário, agendamento de produções em 4 etapas, registro de avarias e termos em PDF."]

    GoogleAPI["Google Calendar API v3<br/>[Sistema Externo]<br/>Autenticação OAuth2 e sincronização de agendas."]

    UserAdmin -->|"Gerencia catálogo, produções e contratos (HTTP/REST)"| System
    UserFree -->|"Consulta agenda, movimenta equipamentos e assina termos (HTTP/REST)"| System
    System -->|"Sincroniza eventos das produções (HTTPS/JSON)"| GoogleAPI
```

### Atores e Integrações
| Elemento | Tipo | Descrição |
| :--- | :--- | :--- |
| **Gestor (`ADMIN`)** | Usuário | Gerencia o inventário, cria e confirma produções (`PATCH /api/v1/productions/:id/confirm`), substitui equipamentos avariados e emite contratos em PDF. |
| **Freelancer (`FREELANCER`)** | Usuário | Consulta tarefas pendentes (`GET /api/v1/productions/my/pending`), retira (`checkout`) e devolve (`checkin`) equipamentos, registra avarias com foto e assina termos. |
| **Google Calendar API** | Externo | Recebe os agendamentos das produções. A chamada passa por um Circuit Breaker (`opossum`) para evitar travamentos caso a API do Google fique indisponível. |

---

## 2. Nível 2 - Diagrama de Containers

Estrutura de execução definida no `docker-compose.yml`. Todos os serviços rodam na rede interna `techacademy-network`, sendo o **Nginx** o único container exposto na porta 80 do host.

```mermaid
flowchart TD
    Client["App Mobile / Cliente HTTP<br/>[React Native / Expo]"]

    subgraph DockerNet ["Rede Docker: techacademy-network"]
        Nginx["Nginx Reverse Proxy<br/>[nginx:alpine - Porta 80]<br/>Recebe requisições externas, aplica limite de 25MB e repassa para a API."]

        API["CaseTrack API<br/>[NestJS 11 / Node.js - Porta 3000 interna]<br/>Regras de negócio, autenticação JWT, cache interceptor, pub/sub e geração de PDF."]

        MySQL[("MySQL 8.0<br/>[ Porta 3306 interna ]<br/>Dados relacionais de usuários, equipamentos, produções, avarias, contratos e logs de eventos.")]

        Redis[("Redis 7<br/>[redis:7-alpine - Porta 6379 interna]<br/>Cache-Aside com TTL e canal Pub/Sub casetrack:events.")]

        Uploads[("Volume Local (./uploads)<br/>[Filesystem]<br/>Fotos de avarias e PDFs de contratos.")]
    end

    GoogleAPI["Google Calendar API<br/>[Serviço Externo]"]

    Client -->|"REST JSON / Multipart (Porta 80)"| Nginx
    Nginx -->|"proxy_pass http://api:3000"| API
    API -->|"TypeORM (TCP 3306)"| MySQL
    API -->|"ioredis Cache & Pub/Sub (TCP 6379)"| Redis
    API -->|"Leitura e escrita de arquivos"| Uploads
    API -->|"HTTPS + Circuit Breaker"| GoogleAPI
```

### Resumo dos Containers
| Container | Imagem / Stack | Porta | Responsabilidade |
| :--- | :--- | :--- | :--- |
| **`nginx`** | `nginx:alpine` | `80:80` (pública) | Proxy reverso para `http://api:3000`, repasse de headers (`Host`, `X-Real-IP`, `X-Forwarded-For`), timeout de `60s` e limite de upload de `25M`. |
| **`api`** | NestJS 11 / TypeScript | `3000` (`expose` interno) | Backend estruturado como monólito modular (`Auth`, `Users`, `Equipments`, `Productions`, `Damages`, `Contracts`, `Redis`, `Events`). |
| **`mysqldb`** | `mysql:8.0` | `3306` | Banco relacional principal com transações ACID e controle de concorrência (`SELECT ... FOR UPDATE`). |
| **`redis`** | `redis:7-alpine` | `6379` (`expose` interno) | Cache de consultas frequentes (`volatile-lru`, máx `256mb`) e mensageria assíncrona via Pub/Sub. |
