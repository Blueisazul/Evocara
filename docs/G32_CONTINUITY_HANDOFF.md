# DOCUMENTO DE CONTINUIDAD TÉCNICA — HITO G32
## Transición Hacia la Promoción de Producción Local y Despliegue General (v0.4.0 GA)

**Fecha:** 24 de octubre de 2026  
**Autor:** Antigravity AI — Ingeniero Principal & Arquitecto de Software Senior  
**Estado:** Hito G32 COMPLETADO AL 100% — Entregado y empíricamente verificado  
**Rama:** `feat/g31-g32-continuity` (workspace canónico `c:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\OpenMemory`)

---

### 1. Estado Actual del Repositorio Canónico

1. **Código Base Protegido en Git:**
   - Rama: `feat/g31-g32-continuity`.
   - Commit base verificado: `0d68365` (*feat(canonical-baseline): checkpoint verified G30-G31 bi-temporal and decision lineage codebase*).
   - Implementación G30/G31/G32 intacta, compilando limpiamente con `npm run build` (Exit code 0).
2. **Entregables de G32 Creados:**
   - Arnés de benchmark: `.work/experiments/test-g32-continuity-benchmark.js`.
   - Evidencia estructurada JSON: `.work/evidence/g32-continuity-benchmark-results.json`.
   - Informe técnico: `docs/G32_TECHNICAL_REPORT.md`.
3. **Métricas Consolidadas G32 (ON vs OFF en InventoryHub):**
   - Precisión de decisiones: **100.0 % (ON)** frente a **22.9 % (OFF)** (+77.1 pp).
   - Ahorro de tokens en contexto: **88.6 % de reducción** (580 vs 5,070 tokens).
   - Pruebas de negocio preservadas: **34/34 PASS (ON)** vs Regresión por resurrección de JSON legado (OFF).
   - Falsos descubrimientos ($K=0$): **0.0 % (ON)** vs 100 % alucinaciones (OFF).

---

### 2. Instrucciones de Reproducción Local Rápida

Para verificar de forma autónoma y reproducible todo el bloque:

```bash
cd c:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\OpenMemory

# 1. Compilación TypeScript
npm run build

# 2. Ejecutar la suite G32 de utilidad y continuidad en InventoryHub
node .work/experiments/test-g32-continuity-benchmark.js

# 3. Ejecutar las suites de regresión de linaje (G31) y bi-temporalidad (G30)
node .work/experiments/test-g31-lineage-and-contradictions-suite.js
node .work/experiments/test-g30-bitemporal-suite.js

# 4. Verificar integridad del consumidor protegido InventoryHub
node ../InventoryHub/test_phase_2c4_post_cleanup.mjs
node ../InventoryHub/test_phase_2c2_full.js
```

---

### 3. Estado de los Artefactos Protegidos

| Artefacto / Proyecto | Ruta | Tamaño / Versión | Estado Verificado |
|---|---|---|---|
| **Tarball GA v0.4.0** | `.work/artifacts/evocara-0.4.0.tgz` | 209,910 bytes (SHA-256: `70f31da...`) | **INTACTO Y PRESERVADO** |
| **SBOM CycloneDX** | `.work/artifacts/evocara-0.4.0.cdx.json` | 41,973 bytes (SHA-256: `6621e53...`) | **INTACTO Y PRESERVADO** |
| **Consumidor Activo** | `../InventoryHub` | `openmemory-0.3.14-rc4.tgz` (34/34 PASS) | **INTACTO / NO PROMOVIDO** |

---

### 4. Siguiente Acción Recomendada (Hito G33)

1. **Promoción de InventoryHub:**
   - Una vez autorizado formalmente por el usuario, actualizar la dependencia en `InventoryHub/package.json` de `openmemory-0.3.14-rc4.tgz` a `evocara-0.4.0.tgz`.
   - Ejecutar la batería completa de 34 pruebas de negocio en producción local.
2. **Sincronización de Git:**
   - Fusionar la rama `feat/g31-g32-continuity` en `master` tras completar la revisión.
