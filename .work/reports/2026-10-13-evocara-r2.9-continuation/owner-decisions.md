# Decisiones requeridas del propietario — R2.9

Responda `APROBAR`, `RECHAZAR` o `MODIFICAR` y especifique el alcance. La aprobación documental no autoriza operaciones fuera de ese alcance.

## D-02 — driver y runtime

1. ¿Autoriza evaluar `better-sqlite3@13.0.3` como candidato, sin seleccionarlo para producción ni crear DB? `___`.
2. Node mínimo y OS/CPU permitidos: `___`.
3. Instalación: ¿offline sin compilación, offline con prebuild/cache y fallback compilado, u otra? `___`.
4. ¿Qué comandos de instalación/inspección se autorizan y en qué sandbox? `___`.

La evaluación del driver no autoriza DB ni P01–P12.

## D-04 — autoridad por entidad

¿Aprueba/modifica la matriz de R2.4.2 para records, documentos, índices derivados, receipts, audit events y snapshots? `___`. Especifique filas que permanecen filesystem-authoritative y cómo tratar divergencias sin elegir por timestamp: `___`.

## D-07 — CAS y commit

¿Aprueba `expectedRevision` con incremento condicional, `REVISION_CONFLICT` separado de contención `BUSY`, y rollback confirmado separado de `OUTCOME_UNKNOWN`? `___`. Política de retry, resultado desconocido y resolución por cliente: `___`.

## D-09 — idempotencia

- Namespace `(principalId, scopeId, operationType, idempotencyKey)`: `___`.
- Canonicalización/hash versionados y campos incluidos: `___`.
- Receipt durable atómica con mutación; replay idéntico y key con payload distinto: `___`.
- Consulta/autorización ante `OUTCOME_UNKNOWN`: `___`.
- TTL, purge, backup, deletion y retención: `___` (coordinar D-05/D-08/D-12).

## D-10 — integridad

¿Aprueba fail-closed para corrupción/schema futuro, no reemplazar datos con defaults, health check read-only y reparación solo explícita? `___`.

## Dependencias de siguientes gates

- D-05 borrado/retención: `___`.
- D-06 identidad principal/scope para MCP/CLI: `___`.
- D-08 snapshot/backup: `___`.
- D-11 compatibilidad CLI/MCP/alias: `___`.
- D-12 auditoría/privacidad/retención: `___`.
- D-13 restore a destino alternativo: `___`.

## Piloto file-backed P01–P12

Estado actual: `DENIED`. ¿Levanta expresamente la denegación para crear una DB file-backed sintética y ejecutar exclusivamente los casos P01–P12 del gate R2.4.1? `AUTORIZO / MANTENGO DENEGACIÓN / MODIFICAR: ___`.

Si autoriza, fije driver/tag, runtime/OS/CPU, root base absoluto fuera de OneDrive, recursos y pruebas exactas: `___`.

La aprobación del piloto no autoriza integración, datos reales, cutover, restore real, borrado/purge ni benchmark.
