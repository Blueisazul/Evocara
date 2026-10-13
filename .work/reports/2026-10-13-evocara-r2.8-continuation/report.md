# Evocara R2.8 — validación y continuidad

## Dictamen

**Documentación: `COMPLETED_DOCUMENTAL`.** **Evaluación del driver y piloto: `BLOCKED_BY_AUTHORIZATION`.** No hay aprobación posterior explícita para D-02, D-04, D-07 detalles, D-09, ni para levantar el `DENIED` del piloto. No se instaló ni probó el driver, no se creó DB y P01–P12 siguen `NOT RUN`.

## Preflight y preservación

- Checkout verificado en `.`, `master`, HEAD `4ab1463446c72bd557f3a6d340285259743f23e9`, igual a referencia.
- `git status --short` muestra las siete modificaciones rastreadas conocidas: dos rutas `.openmemory/spike/*` y cinco `.work/evidence/*`. Se preservan. Sus contenidos no fueron leídos. No se accedió a InventoryHub.
- Los documentos R2.7 requeridos están presentes salvo una referencia rota: su `continuation-prompt.md` menciona `decision-register.md`, que no existe en ese directorio. Los estados sí aparecen en `traceability-matrix.md` y `report.md`. R2.8 crea un registro explícito sin editar R2.7.
- El manifiesto R2.7 contiene hashes de cinco entregables; todos coinciden al recalcularlos en esta ejecución. La carpeta R2.8 estaba ausente antes de crearla.

## Reconciliación de decisiones

No encontré respuestas nuevas. D-01/D-03/D-07/D-10 conservan únicamente los límites ya aprobados en R2.6/R2.7; D-02, D-04, D-05/06/08/09/11–14 siguen pendientes; piloto `DENIED`. No se interpreta el presente encargo como aprobación de opciones técnicas.

La revisión documental encontró una dependencia importante, no una autorización implícita: P09/P10 requieren snapshot/restore, pero D-08/D-13 siguen pendientes y D-05 gobierna retención/borrado. Para ejecutar esos casos deben aprobarse explícitamente las políticas y el alcance de prueba. La tabla completa D-01–D-14/P01–P12 está en `traceability-matrix.md`.

## Alcance ejecutado

Preflight read-only, lectura selectiva de R2.7 y formulario R2.4.2, comprobación del manifiesto/hash R2.7, y creación/validación documental R2.8. No se reabrió código, no se leyeron los cinco artefactos históricos de evidence, y no se ejecutaron pruebas, builds, instalaciones, DB, migraciones, backup/restore o benchmarks.

Solo los siete archivos de este directorio son nuevos. Archivos de producto modificados: cero. Head y las siete modificaciones rastreadas permanecen iguales al preflight.

## Próxima acción

El propietario debe completar [owner-decisions.md](owner-decisions.md): D-02 con el alcance exacto de evaluación; D-04 por entidad; D-07 commit/CAS; D-09 idempotencia y retención; D-10 operación fail-closed; decisiones cruzadas D-05/06/08/11/12/13; y, por separado, si levanta la denegación del piloto P01–P12. Evaluar driver no autoriza DB. Piloto no autoriza integración, migración, restore real, borrado ni benchmark.
