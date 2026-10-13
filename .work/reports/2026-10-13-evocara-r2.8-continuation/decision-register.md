# Registro reconciliado R2.8

Estados basados en R2.6/R2.7 y R2.4.2. No se identificó aprobación nueva. El presente registro repara solo la referencia documental incompleta del prompt R2.7; no cambia decisiones históricas.

| ID | Estado | Evidencia actual | Alcance permitido | Pendiente / gate |
|---|---|---|---|---|
| D-01 | `APPROVED_WITH_LIMITS` | R2.6/R2.7 | Dirección híbrida; JSON/Markdown actual conserva canon | Autoridad/cutover separado D-04 |
| D-02 | `PENDING_OWNER_APPROVAL` | Formulario R2.4.2 sin respuesta; driver-evaluation es recomendación | Análisis documental existente | Artefacto/tag, Node, OS/CPU, offline/toolchain; aprobación de evaluación |
| D-03 | `APPROVED_WITH_LIMITS` | R2.4.2, R2.7 | Evaluación futura local sintética como alcance | No certifica filesystem; root/persistencia requieren piloto |
| D-04 | `PENDING_OWNER_APPROVAL` | Matriz de autoridad propuesta R2.4.2; R2.7 | Ningún cambio de fuente efectiva | Aprobación por entidad, conflicto/reconcile, cutover |
| D-05 | `PENDING_OWNER_APPROVAL` | Registros R2.6/R2.7 | Ninguna política mutativa | Delete/tombstone/retención/purge, incluso backups |
| D-06 | `PENDING_OWNER_APPROVAL` | Contratos de scope previos | Ninguna integración/autorización afirmada | Principal verificado, issuer, scopes, revocación y pruebas |
| D-07 | `APPROVED_WITH_LIMITS` | CAS aceptado como requisito únicamente | Diseño documental | expectedRevision, incremento, BUSY/conflict, rollback/unknown y pruebas |
| D-08 | `PENDING_OWNER_APPROVAL` | Backup parcial documentado; sin prueba | Ningún snapshot/restore real | Cobertura, consistencia, retención y prueba dedicada |
| D-09 | `PENDING_OWNER_APPROVAL` | Contrato propuesto; formulario vacío | Ninguna receipt/semántica de producto | Namespace, hash/canonicalización, atomicidad, OUTCOME_UNKNOWN, TTL/purge |
| D-10 | `APPROVED_WITH_LIMITS` | Fail-closed aprobado como objetivo | Objetivo de diseño | Errores, schema, health readonly, reparación explícita y aceptación |
| D-11 | `PENDING_OWNER_APPROVAL` | Contratos públicos existentes no revalidados aquí | Ningún cambio CLI/MCP/package | Matriz compatibilidad, aliases y autorización integración |
| D-12 | `PENDING_OWNER_APPROVAL` | Sin política audit aprobada | Ningún audit trail afirmado | Campos, privacidad, acceso, integridad, retención/purge |
| D-13 | `PENDING_OWNER_APPROVAL` | Restore actual in-place observado en R2.6 | Ningún restore | Destino alterno, colisiones, rollback y prueba |
| D-14 | `PENDING_OWNER_APPROVAL` (diferible) | Recuperación semántica fuera de core actual | Ningún proveedor nuevo | Corpus/métricas/licencia/privacidad después del core |
| Piloto P01–P12 | `DENIED` | R2.4.1 gate; R2.5–R2.7 ratifican; sin respuesta nueva | Ninguna escritura persistente | Autorización explícita que levante denegación + todas las precondiciones |

### Reglas de no inferencia

- D-01 no aprueba autoridad de cada entidad.
- D-03 no autoriza crear un root ni DB.
- D-07 no es garantía implementada ni autoriza ejecución.
- D-10 es objetivo, no comportamiento actual aceptado.
- Evaluación de driver ≠ DB/piloto. Piloto ≠ integración/migración/restore real/delete/benchmark.
