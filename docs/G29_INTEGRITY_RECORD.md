# REGISTRO CRIPTOGRÁFICO DE INTEGRIDAD Y CADENA DE SUMINISTRO (HITO G29)
## Validación de Artefactos de Release Evocara v0.4.0 GA y Consumidor de Referencia

- **Fecha de Evaluación:** 22 de octubre de 2026
- **Auditor / Release Manager:** Arquitecto de Software Senior & Release Manager de Evocara
- **Rama Base:** `master`
- **Commit Base:** `9dfd79c260e34636d4df91829f33f107db9240fa`
- **Entorno de Evaluación:** Node.js `v22.15.0`, npm `10.9.2`, TypeScript `7.0.2`, Windows x64

---

## 1. Verificación Criptográfica de Artefactos de Release

Se recalcularon de manera independiente los hashes criptográficos SHA-256 y tamaños en bytes de los tres artefactos canónicos de la release Evocara v0.4.0 GA, contrastándolos con los valores esperados de G28 y las declaraciones cruzadas del manifiesto de procedencia y del SBOM CycloneDX 1.5:

| Artefacto | Ruta Canónica | Tamaño Real (Bytes) | Hash SHA-256 Calculado en G29 | Hash SHA-256 Esperado (G28) | Estado de Coincidencia | Etiqueta |
|---|---|---|---|---|---|---|
| **Tarball de Release** | `.work/artifacts/evocara-0.4.0.tgz` | `209,910` | `70f31da7e822bfa8ece60395212e009cac9d39761d02af0325d6c3ee3b8a730a` | `70f31da7e822bfa8ece60395212e009cac9d39761d02af0325d6c3ee3b8a730a` | **100 % MATCH (Bit-a-bit)** | Verificado en esta ejecución |
| **SBOM CycloneDX** | `.work/artifacts/evocara-0.4.0.cdx.json` | `41,973` | `6621e53a415cc7406c02bfcbf55a769c19e5591c338656baa876e23fe23bb0dc` | `6621e53a415cc7406c02bfcbf55a769c19e5591c338656baa876e23fe23bb0dc` | **100 % MATCH (Bit-a-bit)** | Verificado en esta ejecución |
| **Manifiesto de Procedencia** | `.work/artifacts/evocara-0.4.0-manifest.json` | `3,074` | `5edeb88fd07cffa85c803fe1bd347205c019a91c6dbdca83d0e8859d76ed5108` | `5edeb88fd07cffa85c803fe1bd347205c019a91c6dbdca83d0e8859d76ed5108` | **100 % MATCH** | Verificado en esta ejecución |

### Validación Cruzada Criptográfica
1. **Asociación Tarball <-> Manifiesto:**
   - Hash declarado en `manifest.artifacts.tarball.sha256`: `70f31da7e822bfa8ece60395212e009cac9d39761d02af0325d6c3ee3b8a730a` (Coincidencia exacta: `true`).
   - Tamaño declarado en `manifest.artifacts.tarball.sizeBytes`: `209910` (Coincidencia exacta: `true`).
2. **Asociación SBOM <-> Tarball:**
   - Hash declarado en `sbom.metadata.component.hashes[0].content`: `70f31da7e822bfa8ece60395212e009cac9d39761d02af0325d6c3ee3b8a730a` (Coincidencia exacta: `true`).
   - PURL canónico del componente raíz: `pkg:npm/evocara@0.4.0`.
   - Propiedad `artifact:filename`: `evocara-0.4.0.tgz`.
   - Total de dependencias rastreadas en SBOM: 96 componentes.
3. **Validación Formal de Esquemas:**
   - Comando: `node scripts/generate-release-manifest.js --validate` -> **EXIT 0 (PASS)**.
   - Comando: `node scripts/generate-sbom.js --validate` -> **EXIT 0 (PASS)**.

---

## 2. Inspección Estructural del Tarball de Producción

Se inspeccionó el contenido interno de `.work/artifacts/evocara-0.4.0.tgz` sin alterar el archivo ni modificar timestamps:

- **Estructura del paquete:** Empaquetado canónico npm (`package/`).
- **Total de entradas:** 69 archivos distribuidos.
- **Seguridad de Extracción (Zip-Slip / Tar-Slip):** Cero rutas relativas ascendentes (`..`), cero enlaces simbólicos absolutos, cero secuencias de escape de directorio.
- **Ausencia de Fugas de Código Fuente o Pruebas:**
  - `src/`: Excluido estrictamente (0 archivos de desarrollo en paquete).
  - `.work/`: Excluido estrictamente (0 experimentos, informes o evidencias en paquete).
  - `node_modules/`: Excluido estrictamente.
  - `.git/`: Excluido estrictamente.
- **Metadatos en `package/package.json`:**
  - `name`: `"evocara"`
  - `version`: `"0.4.0"`
  - `main`: `"./dist/index.js"`
  - `types`: `"./dist/index.d.ts"`
  - `bin`: `{"evocara": "./dist/cli.js", "openmemory": "./dist/cli.js"}` (Binarios duales).
  - Dependencias de producción: `@modelcontextprotocol/sdk: ^1.30.1`, `zod: ^3.23.0` (Árbol 100 % local, cero dependencias pesadas).

---

## 3. Prueba de Instalación Limpia en Sandbox Aislado

Se ejecutó la prueba de instalación limpia e importación programática (`test-g28-clean-installation.js`):

- **Directorio de Sandbox:** `os.tmpdir()` (`C:\Users\sant1\AppData\Local\Temp\g28-clean-install-w06h2o`).
- **Comando:** `npm install "<PROJECT_ROOT>\.work\artifacts\evocara-0.4.0.tgz" --save-exact`
- **Resultados:**
  1. `npm install` completado con código de salida 0.
  2. `node_modules/evocara` instalado con éxito declarando `evocara@0.4.0`.
  3. Exportaciones programáticas probadas: `StorageEngine`, `createMCPServer`, `createEvocaraMCPServer`, `StageEngine`, `PathSecurityError`, `validateDomainId`, `runCLI` funcionales.
  4. Ejecución CLI vía Node:
     - `node dist/cli.js --version` -> Retorna: `Evocara (formerly OpenMemory) v0.4.0 (package: evocara@0.4.0)`.
     - Invocación con comando `--help` valida soporte dual `evocara` y `openmemory`.
- **Dictamen:** **4 / 4 PASSED (100 %)**. [Etiqueta: Verificado en esta ejecución].

---

## 4. Auditoría de Inviolabilidad del Consumidor Activo (`InventoryHub`)

Se auditó el estado del consumidor local de referencia `InventoryHub`:

| Parámetro | Valor Verificado en Vivo | Línea Base Esperada | Cumplimiento |
|---|---|---|---|
| **Ruta Física** | `C:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\InventoryHub` | `.../InventoryHub` | **100 % Correcto** |
| **Versión en `package.json`** | `"openmemory": "file:../../../../../Downloads/OpenMemory/.work/artifacts/openmemory-0.3.14-rc4.tgz"` | `0.3.14-rc4` | **100 % Intacto (0 mutaciones)** |
| **Versión en `node_modules/openmemory`** | `0.3.14-rc4` | `0.3.14-rc4` | **100 % Intacto (0 mutaciones)** |
| **Locks Residuales** | Cero archivos `.promotion.lock` | Cero locks | **100 % Limpio** |
| **Pruebas de Negocio en Vivo** | 34 / 34 tests aprobados (FIFO, COGS, inventario, SQLite) | 34 / 34 | **100 % Funcional** |

---

## 5. Dictamen de Integridad de la Release

El artefacto `evocara-0.4.0.tgz` y sus metadatos SBOM y manifiesto cumplen al 100 % los estándares de integridad criptográfica y cadena de suministro SLSA Nivel 1.
El estado del paquete está **calificado técnicamente para General Availability (GA)**.
El artefacto permanece **no publicado** en registros remotos y **no desplegado** en el consumidor activo `InventoryHub`, a la espera de autorización humana formal explícita.
