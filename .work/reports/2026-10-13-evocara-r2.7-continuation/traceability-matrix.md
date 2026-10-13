# Matriz compacta de trazabilidad R2.7

Fuentes de decisión/código reutilizadas: informe/registro/diseño/prompt R2.6; `pilot-acceptance-gate.md` R2.4.1. Los símbolos se copian de la inspección estática R2.6; no se reabrió código. `UNKNOWN` significa no confirmado por esas fuentes.

## Decisiones D-01–D-14

| ID | Estado de autorización | Evidencia documental | Símbolos/rutas conocidos | Cambio futuro necesario | Prueba que deberá demostrarlo | Gate requerido | Bloqueo/dependencia |
|---|---|---|---|---|---|---|---|
| D-01 | `APPROVED_WITH_LIMITS` | R2.6 decision-register; R2.4.2 authority matrix | `src/storage.ts: StorageEngine` | Diseñar migración/cutover por entidad sin cambiar canon ahora | Migración dry-run, reconcile/rollback con hashes | Aprobación separada cutover | D-04/05/08/13 |
| D-02 | `PENDING_OWNER_APPROVAL` | R2.4.2 driver-evaluation; R2.6 register | `package.json` (R2.6 no auditó de nuevo) | Fijar artefacto, runtime y targets antes de evaluar | Instalación limpia/offline por Node+OS/CPU y SBOM | Aprobación explícita de evaluación | Tag, Node, OS/CPU, toolchain `UNKNOWN` |
| D-03 | `APPROVED_WITH_LIMITS` | R2.4.2 register; R2.5/2.6 prompts | Root futuro; código de paths en `StorageEngine` | Definir filesystem/root de evaluación; no certificar soporte | P01 en entorno aprobado | Gate de piloto aparte | FS exacto `UNKNOWN`; OneDrive fuera |
| D-04 | `PENDING_OWNER_APPROVAL` por entidad | R2.4.2 data-authority-matrix | Research JSON, Markdown ADR/handoff en `src/storage.ts` | Aprobar canon por entidad y reconciliación | Import dry-run, conteos, hashes, divergencias detenidas | Contrato de autoridad + cutover | Filas de matriz y política de conflictos |
| D-05 | `PENDING_OWNER_APPROVAL` | R2.6 decision-register | `deleteResearch`; backup/restore en `StorageEngine` | Especificar delete/tombstone/TTL/purge por entidad | Casos de borrado, backups y no-resurrección | Aprobación owner/privacy | D-08/09/12/13 |
| D-06 | `PENDING_OWNER_APPROVAL` | R2.4.2 security contracts; R2.6 design | `ResearchRecord.agentId/sessionId`; consumidores `mcp.ts`, `cli.ts` | Identidad verificada y scope separado del payload | Spoof/cross-scope/denegación por transporte | Gate de seguridad e integración | Principal/issuer/revocación `UNKNOWN` |
| D-07 | `APPROVED_WITH_LIMITS` como requisito | R2.6 register; CAS design | `ResearchRecord` no tiene revision; `saveResearch` | Agregar CAS/revisión solo bajo contrato cerrado | Dos escritores misma revisión: uno commit, uno conflict | Contract closure + piloto autorizado | Error mapping/commit uncertainty pendiente |
| D-08 | `PENDING_OWNER_APPROVAL` | R2.4.2 matrix; R2.6 design | `createBackup/listBackups/restoreBackup` | Snapshot coherente DB+documentos+manifest | Hashes, WAL-aware backup y restore alterno | Aprobación backup/restore | Cobertura/retención `UNKNOWN`; D-05/13 |
| D-09 | `PENDING_OWNER_APPROVAL` | R2.4.2 idempotency contract; R2.6 design | No receipt API observada; `saveResearch` es punto futuro | Namespace, canonicalización, receipt co-commit, unknown-status y retención | Replay igual/distinto, retries concurrentes/restart | Aprobación D-09 + piloto | D-04/06/07/12 |
| D-10 | `APPROVED_WITH_LIMITS` como objetivo | R2.6 design y register | `getOrInitManifest/getOrInitProjectState`, `listResearches`, `runDiagnostics` | Fail-closed; health readonly y repair explícito | Corrupción/schema futuro, bytes/hash invariables | Contrato + prueba de adapter | Comportamiento objetivo no implementado |
| D-11 | `PENDING_OWNER_APPROVAL` | R2.6 register | `src/index.ts`, `src/cli.ts`, `src/mcp.ts` | Factory/adaptador y compatibilidad/alias por versionado | Consumers legacy, CLI/MCP clean install | Integración separada | Contratos públicos aceptados `UNKNOWN` |
| D-12 | `PENDING_OWNER_APPROVAL` | R2.4.2 register; R2.6 design | Logs/diagnostics en `StorageEngine` (no audit contract) | Definir eventos mínimos, acceso, integridad, retención | Falta/doble evento, autorización y purge | Aprobación audit/privacy | D-05/08/09 |
| D-13 | `PENDING_OWNER_APPROVAL` | R2.4.2 register; R2.6 design | `restoreBackup` escribe en ruta activa | Fijar destino nuevo, colisiones y rollback | Destino alterno, traversal/colisión, source hash intacto | Gate restore | D-08 y owner policy |
| D-14 | `PENDING_OWNER_APPROVAL` diferible | R2.6 register | `queryKnowledgeItems/formatKnowledgeIndexSummary` | Recuperación/provider modular posterior | Corpus sintético, relevancia/provenance/calidad | Gate de recuperación | D-01/04 y evaluación de calidad; no bloquea driver |

## Casos del piloto P01–P12

Todos bloqueados por el piloto `DENIED`; ninguno ejecutado. Detalles originales en el gate R2.4.1.

| ID | Estado | Símbolo/ruta conocida | Prueba requerida | Gate/dependencia |
|---|---|---|---|---|
| P01 Root/confinamiento | `BLOCKED_BY_AUTHORIZATION` / `NOT RUN` | `StorageEngine(baseDir?)`; paths `path.join` | Root inexistente local no-synced, no reparse/escape, sentinel intacto | Levantar denegación + D-02/D-03 |
| P02 CRUD/schema | `BLOCKED_BY_AUTHORIZATION` / `NOT RUN` | `saveResearch/getResearch/listResearches/deleteResearch` | CRUD, inválidos sin write, IDs/revisiones | D-04/D-05/D-07/D-10 + piloto |
| P03 Reopen | `BLOCKED_BY_AUTHORIZATION` / `NOT RUN` | Atomic file writes actuales; adapter futuro | Commit-close-reopen y estado igual | D-02 + piloto |
| P04 CAS concurrente | `BLOCKED_BY_AUTHORIZATION` / `NOT RUN` | Sin CAS en `ResearchRecord` | Dos writers misma revision: 1 commit/1 conflict | D-07 técnico + driver + piloto |
| P05 Idempotencia | `BLOCKED_BY_AUTHORIZATION` / `NOT RUN` | No receipt observada | Replay/restart/concurrent retries/hash-conflict | D-06/D-07/D-09 + piloto |
| P06 Commit incierto | `BLOCKED_BY_AUTHORIZATION` / `NOT RUN` | No operation status API observada | Fault post-commit; resolver misma key sin duplicar | D-07/D-09 + piloto |
| P07 Rollback/fault | `BLOCKED_BY_AUTHORIZATION` / `NOT RUN` | Atomic writer per-file observado | Fault points y estado completo/no cambio | Driver + contrato commit + piloto |
| P08 Corrupción/schema | `BLOCKED_BY_AUTHORIZATION` / `NOT RUN` | `getOrInit*`, `listResearches`, `runDiagnostics` | Rechazo read-only y bytes fuente invariables | D-10 implementable + piloto |
| P09 Snapshot | `BLOCKED_BY_AUTHORIZATION` / `NOT RUN` | `createBackup` | Manifiesto completo y punto consistente | D-08 + piloto |
| P10 Restore alterno | `BLOCKED_BY_AUTHORIZATION` / `NOT RUN` | `restoreBackup` actual in-place | Destino alterno, rechazo colisión/escape, source intacta | D-13 + piloto explícito limitado |
| P11 Ledger | `BLOCKED_BY_AUTHORIZATION` / `NOT RUN` | Runner/ledger nuevo `UNKNOWN` | Una terminal por intento y conteos reconciliados | Definir harness + piloto |
| P12 Reproducibilidad | `BLOCKED_BY_AUTHORIZATION` / `NOT RUN` | Scripts aislados nuevos `UNKNOWN` | Run IDs, hashes, comandos y conservación de fallos | Protocolo + piloto |
