# DOCUMENTO DE CONTINUIDAD Y HANDOFF (HITO G27 -> G28)
## Paso Final hacia la Promoción Autorizada de InventoryHub y Publicación de Evocara v0.4.0 GA

- **Fecha:** 22 de octubre de 2026
- **Emisor:** Agente Autónomo G27 (Arquitecto de Software & Release Manager)
- **Receptor:** Agente Operativo G28 / Operador Humano
- **Línea Base Consolidada:** Hito G27 Completado al 100 %
- **Candidato Calificado:** `openmemory-0.3.15-rc11.tgz` (SHA-256: `CCEEB715604BF64F1287F732F704683F8352276FC63D41B71D1D4147D842CDAF`)
- **SBOM Asociado:** `openmemory-0.3.15-rc11.cdx.json` (SHA-256: `3f123387ddcbc70fc9387a45bea36522118f373b2d69e3588dbe1cac266198f7`)
- **Consumidor Activo:** `InventoryHub` (Protegido en `0.3.14-rc4`, 34/34 pruebas de negocio aprobadas)

---

## 1. Resumen del Estado Técnico al Cierre de G27

1. **Identidad Dual Evocara / OpenMemory:**
   - Despachador MCP normalizado: cualquier cliente puede invocar `evocara_*` o `openmemory_*` con idéntico comportamiento, autorización y rendimiento.
   - Opciones de prefijo disponibles: `openmemory` (default curado de 8 herramientas), `evocara` (curado de 8 herramientas Evocara), o `dual` (16 herramientas).
   - Comandos CLI duales: `openmemory` y `evocara` operativos en el entorno local.
2. **Seguridad de la Cadena de Suministro:**
   - SBOM CycloneDX 1.5 JSON generado y atado criptográficamente al tarball candidato.
   - Auditoría de dependencias completada: riesgos de avisos HTTP/OAuth de MCP mitigados por arquitectura STDIO.
   - Licencias permisivas al 100 % (MIT / Apache 2.0).
3. **Calificación en Staging de InventoryHub:**
   - 8 de 8 fases aprobadas bajo el candidato `rc11`.
   - Las 34 pruebas de negocio de InventoryHub pasan al 100 % en el entorno promovido.
   - Simulacro de rollback atómico comprobado con 100 % de paridad de bytes.
   - El consumidor activo de producción local **permanece intacto y protegido** en `0.3.14-rc4`.
4. **Calidad de Recuperación BM25 + TMS:**
   - Benchmark canónico: **105 / 105 aprobados (100.0 %)**, Precision@1 = 100.0 %, MRR = 1.000, False Discovery Rate = 0.0 %.
   - Baterías unitarias, multilingüe, no respondibles e invariantes aprobadas al 100 %.

---

## 2. Ubicación de Entregables Clave de G27

| Entregable | Ruta en el Repositorio | Descripción |
|---|---|---|
| **Informe Técnico G27** | `docs/G27_TECHNICAL_REPORT.md` | Informe completo de implementación y pruebas. |
| **Matriz de Compatibilidad** | `docs/G27_COMPATIBILITY_MATRIX.md` | Mapeo de equivalencia de herramientas MCP y CLI dual. |
| **Informe de Supply Chain** | `docs/G27_SUPPLY_CHAIN_SECURITY_REPORT.md` | Auditoría de dependencias, licencias y validación SBOM. |
| **Registro de Release Candidate** | `docs/G27_RELEASE_CANDIDATE_RECORD.md` | Hashes, tamaños, suites y metadatos de `rc11`. |
| **Runbook de Promoción** | `docs/G27_PROMOTION_RUNBOOK.md` | Procedimiento transaccional de promoción y rollback. |
| **Roadmap Actualizado** | `ROADMAP.md` | Hoja de ruta consolidada hacia v0.4.0 GA. |
| **Paquete Tarball Candidato** | `.work/artifacts/openmemory-0.3.15-rc11.tgz` | Artefacto distribuido localmente (208,927 bytes). |
| **SBOM CycloneDX 1.5** | `.work/artifacts/openmemory-0.3.15-rc11.cdx.json` | Software Bill of Materials formal (41,998 bytes). |
| **Manifiesto de Release** | `.work/artifacts/openmemory-0.3.15-rc11-manifest.json` | Manifiesto criptográfico de `rc11`. |
| **Evidencia de Staging** | `.work/evidence/g27-inventoryhub-staging-evidence.json` | Registro de 8/8 fases de staging y rollback. |

---

## 3. Próximo Bloque de Trabajo Recomendado (Hito G28 / GA Cut)

### Misión Única:
Obtener la autorización humana del usuario para ejecutar la promoción transaccional de `InventoryHub` a `0.3.15-rc11`, validar las 34 pruebas de negocio en el consumidor activo, y realizar el corte definitivo de **Evocara v0.4.0 General Availability**.

### Secuencia de Ejecución:
1. **Paso 1 — Promoción Autorizada de InventoryHub:**
   - Solicitar al usuario confirmación explícita para aplicar `openmemory-0.3.15-rc11.tgz` sobre `InventoryHub` siguiendo `docs/G27_PROMOTION_RUNBOOK.md`.
   - Ejecutar la promoción atómica mediante `TransactionalPromotionEngine`.
   - Verificar la aprobación de las 34 pruebas de negocio en vivo.
2. **Paso 2 — Corte Definitivo Evocara v0.4.0 GA:**
   - Empaquetar el artefacto de distribución general `evocara-0.4.0.tgz`.
   - Generar el SBOM definitivo `evocara-0.4.0.cdx.json`.
   - Congelar la versión GA y declarar el hito v0.4.0 formalmente completado.
