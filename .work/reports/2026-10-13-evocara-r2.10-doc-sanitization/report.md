# Evocara R2.10 — saneamiento y commit documental

## Dictamen

Saneamiento y validación documental completados. Se retiró la ruta absoluta del perfil local de R2.7–R2.9 usando `.` como raíz relativa del repositorio. Los hashes de los artefactos afectados se recalcularon en los manifiestos originales; sus valores anteriores y nuevos constan en `sanitization-ledger.md`.

## Preflight y preservación

- Checkout: `.`, rama `master`, HEAD inicial `4ab1463446c72bd557f3a6d340285259743f23e9`.
- Siete modificaciones rastreadas preexistentes identificadas y excluidas: `.openmemory/spike/events.jsonl`, `.openmemory/spike/state.json`, `.work/evidence/opencode-compaction-payload.json`, `.work/evidence/phase-2-spike-results.json`, `.work/evidence/phase-3.5-e2e-test-results.json`, `.work/evidence/phase-4.3-installer-test-results.json`, `.work/evidence/phase-4.5-benchmark-test-results.json`. No se leyeron ni modificaron sus contenidos.
- No se accedió a InventoryHub, al contenido de `.openmemory/` ni a los cinco artefactos históricos de evidencia restringidos.
- No se modificó código, configuración, dependencias o datos.

## Verificaciones ejecutadas

- Los manifiestos R2.7, R2.8 y R2.9 parsean como JSON y sus hashes coinciden: 5/5, 6/6 y 7/7.
- Escaneo de los paquetes R2.7–R2.10: cero coincidencias de rutas personales conocidas, cero patrones básicos de secretos y cero enlaces Markdown relativos rotos.
- Se verificaron los SHA-256 de los documentos listados en el manifiesto R2.10. El hash del propio manifiesto se informa al cierre porque un manifiesto no puede contener su propio hash estable.
- No se ejecutaron tests de producto, instalaciones, builds, operaciones DB, migraciones, backup/restore o benchmarks.

## Alcance y decisiones

D-02, D-04 y D-09 permanecen `PENDING_OWNER_APPROVAL`; el piloto file-backed permanece `DENIED` y P01–P12 `NOT RUN`. El saneamiento documental no cambia esos estados ni constituye aceptación técnica.

Los archivos seleccionados son únicamente los entregables de los paquetes R2.7, R2.8, R2.9 y este paquete R2.10. El staging se revisó antes del commit. No se hizo push.
