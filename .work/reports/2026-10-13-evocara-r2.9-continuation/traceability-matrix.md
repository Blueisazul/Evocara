# Matriz R2.9 — estado verificado y heredado

Los símbolos/código se heredan explícitamente de la inspección R2.6; no se reabrió el código. Los metadatos de Node/package se verificaron en R2.9. `UNKNOWN` = no demostrado. Todas las pruebas siguientes quedan `NOT RUN` salvo la verificación documental del manifiesto.

## D-01–D-14

| ID | Estado (origen) | Código/ruta o hecho R2.9 | Cambio futuro | Prueba requerida | Gate siguiente / bloqueo |
|---|---|---|---|---|---|
| D-01 | `APPROVED_WITH_LIMITS` heredado R2.8 | `src/storage.ts:StorageEngine`; JSON actual | Cutover por entidad, no aquí | Dry-run reconcile/rollback hashes | D-04/05/08/13 |
| D-02 | `PENDING_OWNER_APPROVAL` R2.8, sin respuesta nueva | Node local v22.15.0 win32/x64; package no `engines`; better-sqlite3 absent from manifests. Upstream v13.0.3 Node>=22, MIT | Aprobar artefacto/runtime/platform/install | Clean install/offline/toolchain y SBOM, solo autorizado | D-02 owner approval |
| D-03 | `APPROVED_WITH_LIMITS` heredado | FS exacto `UNKNOWN`; no root nuevo | Definir root local no-sync | P01 path/sentinel/reparse | Piloto, no inferir de D-03 |
| D-04 | `PENDING_OWNER_APPROVAL` | Records JSON y documentos según R2.6 | Canon por entidad | Reconcile/hash/collision dry-run | Owner + cutover gate |
| D-05 | `PENDING_OWNER_APPROVAL` | `deleteResearch`, backups descritos R2.6 | Semántica delete/retention | Delete, purge, restore no-resurrection | D-08/09/12/13 |
| D-06 | `PENDING_OWNER_APPROVAL` | `ResearchRecord.agentId/sessionId` declarativos; identidad `UNKNOWN` | Principal/scope verificado | Spoof/cross-scope denial | Security/integration gate |
| D-07 | `APPROVED_WITH_LIMITS` requisito | `ResearchRecord` no revision en inspección R2.6 | CAS typed outcomes | dos writers: un commit/un conflict; fault points | Aprobar semántica y piloto |
| D-08 | `PENDING_OWNER_APPROVAL` | Backup no probado/completo | Snapshot manifiesto/hashes | Consistency + restore alterno | Owner backup gate |
| D-09 | `PENDING_OWNER_APPROVAL` | Receipt/status API `UNKNOWN`/no observada R2.6 | Namespace, canonical hash, durable receipt | Replay/conflict/restart/unknown | D-04/06/07/09 owner approval |
| D-10 | `APPROVED_WITH_LIMITS` objetivo | R2.6 reportó `getOrInit*` defaults en parse error, diagnostics cleanup; no retested | Fail-closed + health readonly | Corrupt/future schema; byte/hash invariant | Implementación aprobada + test |
| D-11 | `PENDING_OWNER_APPROVAL` | Package actual `openmemory@0.1.0`; CLI/MCP direct constructor según R2.6 | Adapter factory/compat | Legacy API/CLI/MCP regression | Integration gate |
| D-12 | `PENDING_OWNER_APPROVAL` | Audit schema `UNKNOWN` | Event policy | event completeness/privacy/purge | D-05/08/09 + owner |
| D-13 | `PENDING_OWNER_APPROVAL` | `restoreBackup` in-place descrito R2.6 | Destination/rollback | alternate root, collision, source unchanged | D-08 + owner |
| D-14 | `PENDING_OWNER_APPROVAL` diferible | `queryKnowledgeItems` existente según R2.6; semantic provider `UNKNOWN` | Provider modular futuro | Relevance/provenance corpus | Retrieval gate |

## P01–P12

| Caso | Estado R2.9 | Base conocida (R2.6/R2.4.1) | Evidencia que falta | Gate |
|---|---|---|---|---|
| P01 Root | `BLOCKED_BY_AUTHORIZATION` | `StorageEngine(baseDir?)` | Root no-sync, realpath, no reparse, sentinel | Piloto + D-02/D-03 |
| P02 CRUD/schema | `NOT RUN` | save/get/list/delete Research | CRUD contra adapter y schema strict | Piloto + D-04/05/07/10 |
| P03 Reopen | `NOT RUN` | Storage file-based actual; adapter nuevo `UNKNOWN` | Close/reopen file-backed | D-02 + piloto |
| P04 CAS | `NOT RUN` | Sin revision en modelo inspeccionado | Dos escritores, resultado CAS inequívoco | D-07 + piloto |
| P05 Replay | `NOT RUN` | Receipt ausente/no observada | Exact replay y different-hash conflict | D-06/09 + piloto |
| P06 Commit unknown | `NOT RUN` | Status API no observada | Fault postcommit/resolución | D-07/09 |
| P07 Rollback | `NOT RUN` | Atomicidad por archivo no equivale a DB transaction | Fault/control y estado reopen | D-02/D-07 |
| P08 Integrity | `NOT RUN` | Fail-closed no aceptado en código | Corrupt/future schema sin source mutation | D-10 |
| P09 Snapshot | `BLOCKED_BY_AUTHORIZATION` | Backup coverage incompleta según fuentes R2.6 | Snapshot point-in-time y manifest | D-05/08 |
| P10 Restore | `BLOCKED_BY_AUTHORIZATION` | Restore actual escribe in-place | Alt destination/no overwrite | D-08/13 |
| P11 Ledger | `NOT RUN` | Harness ledger nuevo `UNKNOWN` | Un terminal por op y reconcile de counts | Piloto autorizado |
| P12 Reproducibility | `NOT RUN` | No ejecutar runners históricos | Nuevo run ID, inputs/versions/hash/commands | Piloto autorizado |
