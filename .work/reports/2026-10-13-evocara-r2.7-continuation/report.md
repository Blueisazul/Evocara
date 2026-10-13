# Evocara R2.7 — autorización y continuidad

## Dictamen

**`COMPLETED_DOCUMENTAL`.** Paquete aditivo creado, con hashes comprobados. El gate técnico de persistencia sigue **`BLOCKED_BY_AUTHORIZATION`**. No se halló aprobación nueva para D-02, D-04, D-09 ni levantamiento de la denegación del piloto.

## Preflight observado

- Checkout real: `.`; rama `master`; HEAD `4ab1463446c72bd557f3a6d340285259743f23e9`, coincide con referencia.
- Los cuatro documentos R2.6 solicitados existen. La lectura del prompt/registro/diseño/informe no contiene respuestas nuevas del propietario.
- Git pre/post mantiene siete rutas rastreadas modificadas: `.openmemory/spike/events.jsonl`, `.openmemory/spike/state.json`, y cinco `.work/evidence/*` listadas en `verification-result.json`. Se observaron por nombre en `git status`; no se leyeron sus contenidos.
- La carpeta R2.7 no existía antes de crearla. Solo se añadieron los seis archivos de este directorio.
- No se abrió contenido de `.openmemory/`, InventoryHub ni evidencia histórica. No hubo inspección nueva del código.

## Estados resultantes

D-01, D-03, D-07 y D-10 conservan aprobación limitada al alcance registrado en R2.6. D-02, D-04, D-09 y D-05/06/08/11–14 permanecen pendientes. Piloto file-backed: `DENIED`. P01–P12: `NOT RUN`; no DB, instalación, tests, build, migración, backup/restore ni benchmark.

La matriz de trazabilidad y las dependencias se basan en R2.6 y en el gate R2.4.1, no en ejecución del producto. Las cuestiones contractuales que bloquean código y la secuencia mínima se detallan en `dependency-review.md` y `next-actions.md`.

## Siguiente acción concreta

El propietario debe responder expresamente D-02 (artefacto/tag, Node, OS/CPU e instalación), las filas D-04, D-09 y si levanta la denegación del piloto para P01–P12. Una aprobación parcial solo desbloquea su alcance literal. La evaluación del driver no autoriza DB; el piloto no autoriza integración, cutover, restore real, borrado ni benchmark.
