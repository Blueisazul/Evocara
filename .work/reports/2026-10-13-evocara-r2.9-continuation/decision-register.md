# Registro de decisiones R2.9

Separa autorización, implementación y prueba. Los estados de autorización son heredados de R2.8 salvo indicación; no hubo nueva respuesta del propietario.

| ID | Autorización | Implementación observada | Prueba/aceptación | Próximo bloqueo |
|---|---|---|---|---|
| D-01 | `APPROVED_WITH_LIMITS`: dirección híbrida | No hay cutover; canon actual sin cambio | Cutover no probado | D-04/08/13 + permiso propio |
| D-02 | `PENDING_OWNER_APPROVAL` | Driver no declarado en manifests; no instalado | Runtime local v22.15 cumple upstream >=22; compat Evocara no probada | Aprobar candidate/tag, Node min, OS/CPU y política install |
| D-03 | `APPROVED_WITH_LIMITS`: evaluación local prevista | No root piloto creado | FS no certificado | Autorización piloto y entorno preciso |
| D-04 | `PENDING_OWNER_APPROVAL` por entidad | Almacenamiento actual no sustituido | Reconcile/cutover no probado | Aprobar autoridad, conflictos y rollback por fila |
| D-05 | `PENDING_OWNER_APPROVAL` | Política de borrado no implementada/validada aquí | Purge/no-resurrection NOT RUN | Retención/delete por entidad y snapshots |
| D-06 | `PENDING_OWNER_APPROVAL` | Identity/scope confiable no verificado | Authz/cross-scope NOT RUN | Definir principal/issuer/scope y gate integración |
| D-07 | `APPROVED_WITH_LIMITS`: CAS requisito | CAS/revision no observados en modelo citado por R2.6 | Dos writers/commit uncertainty NOT RUN | Contrato de revisión, BUSY/conflict/unknown |
| D-08 | `PENDING_OWNER_APPROVAL` | Backup existente no aceptado como completo | Snapshot/restore NOT RUN | Cobertura/consistencia/retención y pruebas |
| D-09 | `PENDING_OWNER_APPROVAL` | Receipt/idempotency no implementada/validada | Replay/unknown NOT RUN | Namespace, hash, atomic receipt, response, TTL/purge |
| D-10 | `APPROVED_WITH_LIMITS`: target fail-closed | No se cambió código; R2.6 señaló rutas recovery actuales | Corrupción/future schema bytes-invariance NOT RUN | Contrato enum, open/read-only health y prueba |
| D-11 | `PENDING_OWNER_APPROVAL` | CLI/MCP unchanged | Compatibility suite NOT RUN | API/alias/matrix y permiso integración |
| D-12 | `PENDING_OWNER_APPROVAL` | Audit policy no establecida | Audit coverage NOT RUN | Campos, integrity, retention/privacy |
| D-13 | `PENDING_OWNER_APPROVAL` | Restore in-place existente no se tocó | Restore alterno NOT RUN | Destino/rollback/no-overwrite approved |
| D-14 | `PENDING_OWNER_APPROVAL` (diferible) | Recuperación semántica no evaluada aquí | Calidad/provenance NOT RUN | Gate posterior; no bloquea driver |
| Piloto | `DENIED` | DB no creada | P01–P12 `NOT RUN` | Aprobación explícita que levante denegación + prerequisitos |

## Resultado de gates

- Validación documental R2.8: `PASS` para JSON/hashes referenciados, con una ruta de diseño a corregir (`R2.8/implementation-design.md` ausente; fuente real R2.6).
- Runtime/driver metadata: `PASS` como observación estática/documental solamente.
- Selección/instalación del driver: `BLOCKED_BY_AUTHORIZATION`.
- Piloto y aceptación funcional: `BLOCKED_BY_AUTHORIZATION` / `NOT RUN`.
