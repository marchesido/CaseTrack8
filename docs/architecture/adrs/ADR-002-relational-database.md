# ADR 002: Uso do MySQL 8.0 (Relacional) como Banco de Dados Principal

* **Status:** Aceito
* **Data:** 08/11/2026
* **Autor:** Douglas Alexandre Marchesi

---

## Contexto

O domínio do CaseTrack possui forte relacionamento entre entidades: uma produção contém várias etapas (`production_stages`), vários equipamentos alocados (`production_equipments`), registros de check-in/check-out (`equipment_movements`), avarias (`damages`) e contratos (`contracts`).

Além disso, um mesmo equipamento físico não pode ser reservado em duas produções com horários sobrepostos. Precisávamos escolher entre um banco NoSQL orientado a documentos ou um banco relacional ACID.

---

## Opções Consideradas

### 1. Banco NoSQL (MongoDB)
* **Vantagens:** Flexibilidade para salvar documentos aninhados.
* **Desvantagens:** Dificuldade maior para cruzar intervalos de datas de equipamentos compartilhados entre várias produções com lock em nível de linha, aumentando o risco de concorrência na reserva.

### 2. Banco Relacional MySQL 8.0 com TypeORM (Escolhida)
* **Vantagens:**
  * Suporte completo a transações ACID e chaves estrangeiras (`FOREIGN KEY`).
  * Permite usar lock pessimista (`SELECT ... FOR UPDATE`) no InnoDB para travar temporariamente os registros dos equipamentos durante a validação de conflito de agenda.
  * Consultas relacionais diretas para filtrar produções por período, status e pendências de usuário.
* **Desvantagens:** Consultas repetidas de listagem podem pesar no banco se não houver cache.

---

## Decisão

Utilizar o **MySQL 8.0 (InnoDB)** gerenciado pelo **TypeORM** como banco de dados principal do sistema, complementado pelo Redis para aliviar a carga de leitura nas rotas mais acessadas.

---

## Consequências

* **Positivas:**
  * Integridade referencial garantida entre produções, equipamentos, movimentações e contratos.
  * Controle seguro de concorrência no `EquipmentReservationPolicyService` via `FOR UPDATE`.
  * Gravação da tabela de auditoria (`event_audit_log`) dentro da mesma transação de confirmação da produção.
* **Negativas / Cuidados:**
  * Exige atenção a índices e conexões ativas no pool do TypeORM.
