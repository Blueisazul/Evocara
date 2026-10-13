# Trazabilidad de requisitos y P01–P12

Las rutas/símbolos se heredan de inspección estática R2.6/R2.7; no se inspeccionó el código de nuevo. Los hashes de fuentes históricos se referencian en `verification-result.json`. `UNKNOWN` identifica un detalle que no está confirmado por esa evidencia. Estados de prueba no implican ejecución en R2.8.

## Decisiones

| ID | Autorización | Evidencia | Código/ruta observado (R2.6) | Cambio futuro | Prueba requerida | Gate siguiente | Bloqueo/dependencia |
|---|---|---|---|---|---|---|---|
| D-01 | `APPROVED_WITH_LIMITS` | R2.6/R2.7; authority matrix R2.4.2 | `src/storage.ts:StorageEngine` | Cutover por autoridad aprobada | Dry-run reconcile + rollback hashes | Cutover propio | D-04/05/08/13 |
| D-02 | `PENDING_OWNER_APPROVAL` | `driver-evaluation.md` R2.4.2 | `package.json` conocido por R2.7, sin relectura | Fijar driver/runtime/targets | Install limpio/offline, SBOM, file-backed posterior | Evaluación autorizada | Tag/Node/OS/CPU/instalación UNKNOWN |
| D-03 | `APPROVED_WITH_LIMITS` | R2.7 register/prompt | Constructor `StorageEngine(baseDir?)` | Seleccionar root/FS de prueba | P01 realpath/sentinel | Piloto separado | FS no certificado; fuera OneDrive |
| D-04 | `PENDING_OWNER_APPROVAL` | `data-authority-matrix.md` R2.4.2 | Research JSON; ADR/handoff files en `src/storage.ts` | Autoridad y reconciliación por entidad | Dry-run hashes, colisiones y conteos | Contrato + cutover | Sin dual-write ni canon nuevo |
| D-05 | `PENDING_OWNER_APPROVAL` | R2.6/2.7 | `deleteResearch`, `createBackup/restoreBackup` | Semántica delete/TTL/purge | Delete + backup restore no-resurrection | Política de datos | D-08/09/12/13 |
| D-06 | `PENDING_OWNER_APPROVAL` | R2.6 design | `ResearchRecord.agentId/sessionId`; `src/mcp.ts`, `src/cli.ts` | Principal/scope confiables | Spoof, cross-scope y deny por transporte | Integración/security gate | Issuer/revocación UNKNOWN |
| D-07 | `APPROVED_WITH_LIMITS` (requisito) | CAS contract R2.6 | `ResearchRecord` sin revision; `saveResearch` | CAS y typed outcomes | Dos writers: un commit/un conflict; faults commit | Contrato + piloto | Rollback/`BUSY`/commit unknown no aprobados |
| D-08 | `PENDING_OWNER_APPROVAL` | R2.6/2.7 | `createBackup/listBackups/restoreBackup` | Snapshot consistente y completo | Hash/manifest, WAL y restore alterno | Backup gate | Cobertura/retención UNKNOWN |
| D-09 | `PENDING_OWNER_APPROVAL` | R2.4.2 idempotency contract; R2.6 | No receipt/status API observada; futuro junto a `saveResearch` | Namespace, canonical hash, receipt atómica/status | Replay, conflict hash, retry, restart/unknown | Contrato + piloto | D-04/06/07/05/08/12 |
| D-10 | `APPROVED_WITH_LIMITS` (target) | R2.6/R2.7 | `getOrInit*`, `listResearches`, `runDiagnostics` | Fail-closed, health readonly | Corrupt/future schema; hashes/bytes invariantes | Contrato + adapter | Código actual no se acepta por objetivo |
| D-11 | `PENDING_OWNER_APPROVAL` | R2.6/R2.7 | `src/index.ts`, `src/cli.ts`, `src/mcp.ts` | Factory/adapters y compat aliases | Legacy CLI/MCP contract suite | Integración propia | APIs/alias aprobados UNKNOWN |
| D-12 | `PENDING_OWNER_APPROVAL` | R2.4.2/R2.6 | Diagnostics/logs en `src/storage.ts` | Audit event schema | Correlación, auth, retención/purge | Audit/privacy gate | D-05/08/09 |
| D-13 | `PENDING_OWNER_APPROVAL` | R2.4.2/R2.6 | `restoreBackup` in-place en fuente observada | Restore a destino nuevo | Collision/path escape/source hash | Restore gate | D-08/retención |
| D-14 | `PENDING_OWNER_APPROVAL` diferible | R2.6 design | `queryKnowledgeItems`, `formatKnowledgeIndexSummary` | Provider opcional posterior | Corpus y evaluación relevancia/provenance | Retrieval gate | D-01/04; no bloquea D-02 |

## Piloto P01–P12

Todos `BLOCKED_BY_AUTHORIZATION` y `NOT RUN`; no se ejecutaron en esta misión.

| Caso | Implementación conocida | Evidencia futura mínima | Dependencia/gate |
|---|---|---|---|
| P01 Root | `StorageEngine(baseDir?)`; rutas existentes | Root nuevo fuera de OneDrive, realpath/volume, reparse/traversal rechazados, sentinel igual | Piloto explícito + D-02/D-03 |
| P02 CRUD/schema | `saveResearch/getResearch/listResearches/deleteResearch` | Operaciones sintéticas y schema inválido sin write | D-04/05/07/10 |
| P03 Reopen | Storage actual por archivo; adapter futuro | Commit-close-reopen + record/revision/receipt | Driver + piloto |
| P04 CAS | No existe revision en `ResearchRecord` | Dos writers/conexiones con una victoria CAS | D-07 contract + driver |
| P05 Idempotencia | No receipt observada | Replay idéntico de una mutación; hash distinto conflict; restart | D-06/07/09 |
| P06 Commit incierto | No status API observada | Fault después posible commit, resolver misma key o seguir unknown | D-07/09 |
| P07 Rollback/fault | Atomic writer por archivo observado | Fallos controlados pre/durante/post commit y estado consistente | Commit contract + driver |
| P08 Integrity | `getOrInit*`, `listResearches`, `runDiagnostics` | Rechazo corrupción/future schema; bytes/hash/mtime fuente sin cambio | D-10 |
| P09 Snapshot | Backup actual conjunto fijo | Point-in-time, coverage manifest y hashes | D-08 + D-05 |
| P10 Restore | `restoreBackup` actual in-place | Destino alterno inexistente; source intacta; collision/escape rechazado | D-13/D-08 y alcance expreso |
| P11 Ledger | Harness nuevo, aún no existe confirmado | Un resultado terminal por op/worker/run; recuento reconciliado | Harness aprobado + piloto |
| P12 Reproducibilidad | Runner nuevo UNKNOWN | Inputs/versions/commands/hash, nueva run ID, no overwrite | Piloto + preservación |

## UNKNOWN explícitos

Runtime/Node soportado en checkout actual, targets OS/CPU, filesystem sandbox disponible, interfaces finales, resultado de P01–P12, esquema final y garantías funcionales: `UNKNOWN`/no verificados para R2.8.
