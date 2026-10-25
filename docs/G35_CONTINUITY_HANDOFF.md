# DOCUMENTO DE CONTINUIDAD TÉCNICA — HITO G35
## Release Formal de Evocara v0.4.0 GA

- **Fecha:** 25 de octubre de 2026
- **Autor / Rol:** Antigravity (Senior Software Architect & Release Manager)
- **Hito Actual:** G35 PREPARADO — BLOQUEADO POR AUTORIZACIÓN EXTERNA Y AUTENTICACIÓN
- **Próximo Paso:** Obtener autorización explícita y credenciales de autenticación para publicación externa en npm y GitHub Releases.

---

## 1. Identificación de Fuentes y Estado Técnico Confirmado

- **Repositorio Canónico Local:** `C:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\OpenMemory`
- **Rama Local:** `master`
- **HEAD Local:** `1c18986cdb25ea1af0f1f336e1bfefb174abb52a`
- **Remoto Canónico:** `https://github.com/Blueisazul/Evocara.git`
- **HEAD Remoto:** `1c18986cdb25ea1af0f1f336e1bfefb174abb52a` (`origin/master` en paridad exacta)
- **Copia Histórica Protegida:** `C:\Users\sant1\Downloads\OpenMemory` (9,528 archivos intactos)
- **Consumidor Real InventoryHub:** `C:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\InventoryHub`
  - Dependencia: `evocara@0.4.0` (vía tarball local)
  - Pruebas de negocio en vivo: **34/34 aprobadas** (`test_phase_2c4_post_cleanup.mjs` 10/10, `test_phase_2c2_full.js` 24/24)
  - Invariante crítico: `inventory-data.json` AUSENTE (0 regresiones).

---

## 2. Artefactos Protegidos y Criptografía

Los artefactos están congelados y verificados bit-a-bit:

1. **Tarball GA:** `.work/artifacts/evocara-0.4.0.tgz`
   - Tamaño: `209,910` bytes
   - SHA-256: `70f31da7e822bfa8ece60395212e009cac9d39761d02af0325d6c3ee3b8a730a`
   - Contenido: 76 archivos auditados (0 secretos, 0 datos de desarrollo).
2. **SBOM CycloneDX:** `.work/artifacts/evocara-0.4.0.cdx.json`
   - Tamaño: `41,973` bytes
   - SHA-256: `6621e53a415cc7406c02bfcbf55a769c19e5591c338656baa876e23fe23bb0dc`
   - Formato: CycloneDX JSON v1.5 (96 componentes trazados).
3. **Manifiesto SLSA:** `.work/artifacts/evocara-0.4.0-manifest.json`
   - Tamaño: `3,074` bytes
   - SHA-256: `5edeb88fd07cffa85c803fe1bd347205c019a91c6dbdca83d0e8859d76ed5108`

---

## 3. Estado Inequívoco de G35 y Destinos de Publicación

- **Preparación de Release:** **COMPLETADA AL 100 %**.
- **Smoke Tests en Sandbox:** **100 % APROBADOS** (`test-g35-isolated-install.js`).
- **npm Registry:**
  - Nombre `evocara` libre (404 Not Found en registry).
  - Autenticación: `ENEEDAUTH` (No autenticado localmente).
  - Publicación npm: **DETENIDA (Pendiente de autorización y credenciales)**.
- **GitHub Release:**
  - Repositorio: `Blueisazul/Evocara`.
  - Tags existentes: `v0.3.0`, `v0.3.1`.
  - Tag propuesto: `v0.4.0`.
  - Creación de Tag y Release: **DETENIDA (Pendiente de autorización)**.

---

## 4. Procedimiento de Ejecución una vez Autorizado

Una vez que el usuario otorgue autorización expresa y proporcione el método de autenticación:

```bash
# 1. Autenticar en npm (interactivo o vía NPM_TOKEN)
npm login
# O configurar NPM_TOKEN en .npmrc o entorno

# 2. Publicar exactamente el tarball protegido verificado
npm publish .work/artifacts/evocara-0.4.0.tgz --access public

# 3. Crear y subir el tag formal de release a GitHub
git tag -a v0.4.0 -m "release: Evocara v0.4.0 GA"
git push origin v0.4.0

# 4. Crear la GitHub Release adjuntando los artefactos protegidos:
# - evocara-0.4.0.tgz
# - evocara-0.4.0.cdx.json
# - evocara-0.4.0-manifest.json
```

---

## 5. Operaciones Estrictamente Prohibidas en este Estado

- **PROHIBIDO** ejecutar `npm publish` sin autorización y credenciales válidas.
- **PROHIBIDO** crear o hacer push de tags a GitHub sin autorización.
- **PROHIBIDO** alterar o regenerar el tarball o el SBOM protegidos.
- **PROHIBIDO** recrear el archivo `inventory-data.json` en InventoryHub.
- **PROHIBIDO** publicar tokens, contraseñas o claves en archivos de documentación o commits.
