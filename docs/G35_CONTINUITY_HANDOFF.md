# DOCUMENTO DE CONTINUIDAD TÉCNICA — HITO G35
## Release Formal de Evocara v0.4.0 GA

- **Fecha:** 25 de octubre de 2026
- **Autor / Rol:** Antigravity (Senior Software Architect & Release Manager)
- **Hito Actual:** G35 TAG v0.4.0 PUBLICADO EN GITHUB — PENDIENTE PUBLICACIÓN MANUAL EN npm Y RELEASE EN GITHUB
- **Próximo Paso:** El propietario ejecutará `npm publish` y la formalización de la GitHub Release con sus credenciales personales.

---

## 1. Identificación de Fuentes y Estado Técnico Confirmado

- **Repositorio Canónico Local:** `C:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\OpenMemory`
- **Rama Local:** `master`
- **HEAD Local:** `be36171d7ba3f3b683953fbc593e6e0658fc28f5`
- **Remoto Canónico:** `https://github.com/Blueisazul/Evocara.git`
- **HEAD Remoto:** `be36171d7ba3f3b683953fbc593e6e0658fc28f5` (`origin/master` sincronizado)
- **Tag Oficial de Release:** `v0.4.0` publicado en GitHub (`https://github.com/Blueisazul/Evocara/tree/v0.4.0`)
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
- **Tag Git Oficial:** `v0.4.0` creado y enviado con éxito a `https://github.com/Blueisazul/Evocara.git`.
- **npm Registry:**
  - Nombre `evocara` libre (404 Not Found en registry).
  - Autenticación: `ENEEDAUTH` (No autenticado localmente).
  - Publicación npm: **PENDIENTE DE EJECUCIÓN MANUAL POR EL PROPIETARIO**.
- **GitHub Release:**
  - Tag existente en remoto: `v0.4.0`.
  - Creación de Release y adjuntos: **PENDIENTE DE FORMALIZACIÓN MANUAL POR EL PROPIETARIO**.

---

## 4. Runbook de Publicación Manual para el Propietario

Conforme a la opción autorizada explícitamente por el propietario, las acciones pendientes a realizar manualmente con credenciales personales son:

```bash
# 1. En una terminal personal, iniciar sesión en npm:
npm login

# 2. Publicar el paquete congelado verificado:
npm publish .work/artifacts/evocara-0.4.0.tgz --access public

# 3. Crear la GitHub Release en:
# https://github.com/Blueisazul/Evocara/releases/new
# - Tag: v0.4.0 (ya existente en remoto)
# - Título: Evocara v0.4.0 GA — Deterministic Operational Memory & Stage Governance
# - Descripción: Copiar las notas de release de docs/G35_TECHNICAL_REPORT.md (Sección 6)
# - Adjuntar los 3 archivos:
#     * .work/artifacts/evocara-0.4.0.tgz
#     * .work/artifacts/evocara-0.4.0.cdx.json
#     * .work/artifacts/evocara-0.4.0-manifest.json
```

---

## 5. Operaciones Estrictamente Prohibidas

- **PROHIBIDO** alterar o regenerar el tarball o el SBOM protegidos.
- **PROHIBIDO** recrear el archivo `inventory-data.json` en InventoryHub.
- **PROHIBIDO** publicar tokens, contraseñas o claves en archivos de documentación o commits.
- **PROHIBIDO** forzar (`--force`) pushes sobre master o tags existentes.
