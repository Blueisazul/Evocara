# Respuestas necesarias del propietario — R2.8

Complete con `APROBAR`, `RECHAZAR` o `MODIFICAR` y especifique el alcance. El silencio o una respuesta parcial no cambia otros gates.

## D-02 — evaluación de driver

1. ¿Autoriza evaluar `better-sqlite3` v13.0.3 como candidato, sin DB ni selección de producción? `APROBAR / RECHAZAR / MODIFICAR: ___`
2. Node mínimo y plataformas/CPU exactas: `___`.
3. Instalación: ¿offline sin compilación, offline con artefactos/cache y fallback de compilación, u otra? `___`.
4. Comandos/operaciones permitidos y prohibidos: `___`.

Esta autorización no permite crear DB ni ejecutar P01–P12.

## D-04 — autoridad por entidad

¿Aprueba o modifica las filas de `data-authority-matrix.md` R2.4.2 para records, documentos, índices, receipts, audit events y snapshots? `___`. Indique qué conserva authority filesystem hasta cutover y cómo resolver conflictos sin timestamp: `___`.

## D-07 — CAS y commit

¿Aprueba `expectedRevision`, incremento condicional, `REVISION_CONFLICT` distinto de contención `BUSY`, rollback confirmado distinto de `OUTCOME_UNKNOWN`? `APROBAR / RECHAZAR / MODIFICAR: ___`. Política de retry y respuesta al cliente ante commit incierto: `___`.

## D-09 — idempotencia

1. Namespace `(principalId, scopeId, operationType, idempotencyKey)` y hash canónico/versionado: `___`.
2. Receipt durable en la misma transacción de la mutación: `___`.
3. Misma key/payload distinto y replay exacto: `___`.
4. Consulta ante `OUTCOME_UNKNOWN` y control de divulgación: `___`.
5. TTL, purge, retención en snapshots y borrado: `___` (coordinar D-05/D-08/D-12).

## D-10 — fail-closed

¿Aprueba que ausencia solo inicialice por acción `createNew` explícita; corrupción/schema futuro/error de lectura se rechacen sin defaults; health check sea read-only y repair/rebuild acción separada? `APROBAR / RECHAZAR / MODIFICAR: ___`.

## Dependencias cruzadas

- D-05 delete/retención/purge por entidad y backup: `___`.
- D-06 principal/scope/issuer para CLI/MCP: `___`.
- D-08 snapshot coverage/consistencia/retención: `___`.
- D-11 compatibilidad CLI/MCP/aliases: `___`.
- D-12 audit fields/access/integrity/retention: `___`.
- D-13 restore solo alterno, colisión/rollback: `___`.

## Piloto P01–P12 — autorización independiente

Estado vigente: `DENIED`. ¿Levanta expresamente la denegación para crear una DB file-backed sintética y ejecutar solo P01–P12 del `pilot-acceptance-gate.md` R2.4.1? `AUTORIZO / MANTENGO DENEGACIÓN / MODIFICAR: ___`.

Especifique driver/tag, Node, OS/CPU, root base absoluto fuera de OneDrive, límites de recursos y casos autorizados: `___`.

La autorización piloto no permite integración, datos reales, cutover, restore real, delete/purge ni benchmark.
