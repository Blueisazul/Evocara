# Revisión documental de dependencias

Alcance: comparación de R2.6 con estados R2.4.2/R2.5 y gate R2.4.1; no inspección nueva del producto.

## Contradicciones / brechas verificadas

1. **D-03 no levanta el bloqueo del piloto.** El alcance previsto de filesystem local sintético es una delimitación de evaluación, mientras R2.4.1/R2.5/R2.6 mantienen el piloto `DENIED`. No es contradicción si los gates se interpretan por separado; sería una inferencia inválida usar D-03 para escribir. Root autorizado: ninguno.
2. **D-01 no resuelve D-04.** La dirección híbrida está aprobada con límites; la autoridad por cada entidad sigue pendiente. El diseño de R2.6 propone tablas/archivos concretos, pero los marca como propuesta. No hay base para dual-write o cutover.
3. **D-07 es requisito, no contrato probado.** CAS figura aprobado como requisito; el modelo actual `ResearchRecord` no incluye revision según lectura R2.6. Commit incierto, clasificación BUSY, garantías de durabilidad y mapping de errores necesitan cierre técnico y prueba real.
4. **D-10 objetivo diverge del comportamiento observado.** R2.6 observó que ciertos `getOrInit*` recrean defaults al capturar JSON corrupto y que diagnostics puede limpiar temporales. Eso no satisface la política objetivo fail-closed/health readonly. No se declara bug corregido ni se permite cambiarlo en este gate.
5. **P09/P10 requieren políticas de gates pendientes.** Gate P01–P12 incluye snapshot/restore; D-08 y D-13 están pendientes y D-05 afecta retención/deletion. El piloto solo puede cubrir esos criterios si la autorización futura los incluye expresamente y sus contratos se cierran. Una autorización de CRUD no basta.
6. **D-09 depende de identidad y autoridad.** Namespace por principal/scope solo es seguro si D-06 define actor confiable y D-04 establece autoridad del receipt junto a la mutación. `agentId/sessionId` en modelo no es evidencia de principal autenticado. Atomic co-commit depende además de D-07; TTL/purge cruza D-05/D-12/D-08.
7. **Propuesta de R2.6 excede todavía decisiones ejecutables.** Las firmas ilustrativas incluyen `delete`, `snapshot`, `restore` y receipt fields, pero D-05/D-08/D-09/D-13 no están aprobadas. Mantener esas firmas como diseño, no congelarlas como contrato.

## Orden mínimo de dependencias

| Gate | Entrada necesaria | Salida verificable | No habilita automáticamente |
|---|---|---|---|
| 0. Documental | Estado Git preservado; ninguna respuesta requerida para revisión | Decision register, diseño trazable y checkpoint | Instalación o escrituras |
| 1. Evaluación de driver | Aprobación D-02: tag, Node, targets, offline/toolchain y comandos | Informe de artefacto/install matrix con hashes | DB, adapter o piloto |
| 2. Contrato del piloto | D-04 filas mínimas, D-07 commit/CAS, D-09 idempotencia/unknown, D-10 fail-closed; D-03 entorno; autorización que levante DENIED | Contrato congelado P01–P12 y root/local preciso | Integración con CLI/MCP |
| 3. Piloto aislado | Gate 1 completo, contratos aprobados, sandbox exclusivo | Adapter/harness y resultados P01–P12 sin datos reales | Integración pública/migración |
| 4. Integración CLI/MCP | Piloto aceptado + D-06 identidad/scope + D-11 compatibilidad + autorización | Adaptadores de transporte y pruebas legacy/scope | Cutover |
| 5. Backup/restore y deletion | D-05/D-08/D-12/D-13 aprobadas por alcance | Snapshots, restore alterno, retention/delete probado | Migración real |
| 6. Migración/cutover | D-04 completo, backup/restore aprobado, reconcile/rollback, autorización independiente | Dry-run reconciliado, luego cutover autorizado | Benchmark |
| 7. Benchmark | Baseline/candidate inmutables, ledger probado, umbrales aprobados y permiso benchmark | Informe rendimiento y variabilidad | Release/publicación |

No hay autorización para gates 1–7 en R2.7 salvo el trabajo documental de gate 0.
