# ADR 001: Adoção de Monólito Modular com Proxy Reverso Nginx

* **Status:** Aceito
* **Data:** 08/11/2026
* **Autor:** Douglas Alexandre Marchesi

---

## Contexto

O CaseTrack gerencia inventário de equipamentos, agendamento de produções em etapas, controle de retirada/devolução com inspeção de avarias e emissão de contratos em PDF.

Na definição da arquitetura, precisamos escolher entre dividir o sistema em microsserviços independentes ou manter um Monólito Modular em NestJS atrás de um proxy reverso Nginx. O ponto principal é que a reserva de equipamentos exige consistência transacional forte (ACID) para impedir que duas produções aloquem o mesmo equipamento no mesmo horário.

---

## Opções Consideradas

### 1. Microsserviços Distribuídos
* **Vantagens:** Deploy e escalabilidade separados por módulo.
* **Desvantagens:** Maior complexidade operacional (vários containers Node.js e bancos separados). A reserva de equipamentos entre serviços diferentes exigiria transações distribuídas (Saga), abrindo margem para conflitos de agendamento até a convergência dos eventos.

### 2. Monólito Modular em NestJS + Nginx + Redis (Escolhida)
* **Vantagens:**
  * Separação clara de responsabilidades por módulos (`ProductionsModule`, `EquipmentsModule`, `DamagesModule`, `ContractsModule`, `AuthModule`, `EventsModule`).
  * Permite usar transações ACID locais e bloqueio pessimista (`SELECT ... FOR UPDATE`) direto no MySQL ao confirmar reservas.
  * Desacopla tarefas secundárias (auditoria e avisos de confirmação) usando Redis Pub/Sub.
  * Simplifica a infraestrutura no `docker-compose.yml`, protegendo a API com o Nginx na porta 80.
* **Desvantagens:** Todos os módulos compartilham o mesmo processo Node.js.

---

## Decisão

Manter o sistema como um **Monólito Modular** em NestJS 11, isolado na rede interna do Docker (`expose: 3000`) e acessível externamente apenas através do **Nginx** (porta 80), com **MySQL 8.0** para persistência e **Redis 7** para cache e mensageria.

---

## Consequências

* **Positivas:**
  * Garantia contra *double-booking* de equipamentos usando transações locais no banco.
  * Menor consumo de memória e facilidade para subir todo o ambiente com `docker compose up`.
  * Segurança de rede: nem a API nem o Redis ficam expostos diretamente nas portas do host.
* **Negativas / Cuidados:**
  * É necessário manter os limites entre módulos bem definidos no código e evitar que uma falha pare o container principal (mitigado com `restart: unless-stopped`, healthchecks e filtro global de exceções).
