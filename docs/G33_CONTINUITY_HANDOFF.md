# DOCUMENTO DE CONTINUIDAD TÉCNICA — HITO G33
## Evocara v0.4.0 GA: Estado de Promoción, Integración y Guía de Operación

- **Fecha:** 24 de octubre de 2026
- **Autor / Rol:** Antigravity (Senior Software Architect & Tech Lead)
- **Hito Actual:** G33 COMPLETADO (Promoción local controlada a Evocara v0.4.0 GA & Merge en Master)
- **Próximo Hito:** G34 (Sincronización remota controlada con GitHub / Preparación para Publicación)

---

## 1. Identificación del Entorno y Fuentes de Verdad

### 1.1. Repositorio Canónico (FUENTE DE VERDAD)
- **Ruta Absoluta:** `c:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\OpenMemory`
- **Rama Canónica:** `master` (integrada con `feat/g31-g32-continuity`)
- **Estado de Compilación:** `npm run build` (`tsc`) pasa con Exit code 0.
- **Artefacto GA Definitivo:** `.work/artifacts/evocara-0.4.0.tgz`
  - SHA-256: `70f31da7e822bfa8ece60395212e009cac9d39761d02af0325d6c3ee3b8a730a`
  - Tamaño: 209,910 bytes
- **SBOM CycloneDX:** `.work/artifacts/evocara-0.4.0.cdx.json`
  - SHA-256: `6621e53a415cc7406c02bfcbf55a769c19e5591c338656baa876e23fe23bb0dc`
  - Tamaño: 41,973 bytes

### 1.2. Consumidor Activo (InventoryHub)
- **Ruta Absoluta:** `c:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\InventoryHub`
- **Tipo de Proyecto:** Node.js ESM (`"type": "module"`)
- **Dependencia Actual:** `"evocara": "file:../OpenMemory/.work/artifacts/evocara-0.4.0.tgz"`
- **Configuración MCP (`opencode.json`):** Ambos perfiles `openmemory` y `evocara` configurados con `node node_modules/evocara/dist/mcp.js`.
- **Estado de Pruebas de Negocio:** **34 / 34 APROBADAS (100 %)**
  - `node test_phase_2c4_post_cleanup.mjs`: 10/10 PASS
  - `node test_phase_2c2_full.js`: 24/24 PASS
  - **Invariante Crítica:** `inventory-data.json` permanece ABSENTE.

### 1.3. Repositorios y Artefactos Históricos Protegidos (NO TOCAR)
- `c:\Users\sant1\Downloads\OpenMemory`: Copia secundaria detenida en G14/G29. Servir sólo como referencia histórica inmutable.
- `OpenMemory v0.3.1`: Baseline histórica congelada.
- `openmemory-0.3.14-rc4.tgz`: Paquete protegido mantenido para capacidades de rollback.
- Repositorio Remoto GitHub (`https://github.com/Blueisazul/Evocara`): Desactualizado. Cero push ejecutados.

---

## 2. Comandos Operativos y de Verificación Rápida

Para re-verificar todo el sistema en < 60 segundos:

```bash
# 1. Compilación de Evocara
cd c:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\OpenMemory
npm run build

# 2. Validación de Artefacto GA y Contratos Públicos (100% PASS)
node .work/experiments/test-g33-artifact-contract-validation.js

# 3. Suites de Regresión Críticas
node .work/experiments/test-g31-lineage-and-contradictions-suite.js   # 18/18 PASS
node .work/experiments/test-g30-bitemporal-suite.js                   # 15/15 PASS
node .work/experiments/test-g27-evocara-compatibility.js             # 9/9 PASS
node .work/experiments/test-g25-mcp-curated-surface.js               # 9/9 PASS

# 4. Verificación de Consumidor (InventoryHub)
cd c:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\InventoryHub
node test_phase_2c4_post_cleanup.mjs                                 # 10/10 PASS
node test_phase_2c2_full.js                                          # 24/24 PASS
```

---

## 3. Procedimiento de Rollback Probado para InventoryHub

Si por cualquier razón se requiere revertir InventoryHub a `openmemory-0.3.14-rc4`:

```bash
cd c:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\InventoryHub
# 1. Restaurar configuraciones originales desde el respaldo atómico
cp backups/backup_g33_promo_1792863055838/package.json package.json
cp backups/backup_g33_promo_1792863055838/opencode.json opencode.json

# 2. Reinstalar con gestor de paquetes
npm install --no-audit --no-fund

# 3. Validar pruebas
node test_phase_2c4_post_cleanup.mjs
node test_phase_2c2_full.js
```

---

## 4. Estado de las Decisiones Arquitectónicas (Congeladas)

1. **Recuperación Determinista BM25:** Mantenida como base primaria de recuperación de memoria sin dependencias vectoriales.
2. **DAG de Linaje en TypeScript:** Totalmente operativo en memoria con orden topológico y BFS bidireccional (p50 = 0.93ms en 50 nodos).
3. **Persistencia Local-First:** Base en `.openmemory/` mediante archivos JSON normalizados y Markdown auditables.
4. **Nomenclatura Dual:** Soporte simétrico transparente para `openmemory_*` y `evocara_*`.
5. **No introducir dependencias externas pesadas:** Cero adopción de Neo4j, Graphiti, bases vectoriales o runtimes externos.

---

## 5. Próximo Paso Recomendado: Hito G34

**Objetivo:** Sincronización Remota Controlada y Preparación de Release Pública.
- Requisitos previos indispensables:
  1. Autorización explícita del propietario para realizar operaciones de red y sincronización con GitHub.
  2. Verificación de credenciales de Git y remotos.
  3. Ejecución de un preflight remoto para asegurar que no se sobrescriban ramas con trabajo no reconciliado.
