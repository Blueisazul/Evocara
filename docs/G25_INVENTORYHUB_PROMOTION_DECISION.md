# Decisión de Promoción de InventoryHub — Hito G25

## 1. Veredicto y Estado de la Decisión

- **Dictamen:** **LISTO PARA PROMOCIÓN CONTROLADA (Consumidor Activo Preservado en 0.3.14-rc4)**
- **Consumidor Activo:** `C:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\InventoryHub`
- **Versión Activa:** `openmemory-0.3.14-rc4.tgz` (SHA-256: `AF88FAE90107DFDA797C7F6BCC982CF6BBD7EF53FD9A5D887C9BF77185A35F6E`)
- **Candidato Calificado:** `openmemory-0.3.15-rc8.tgz` (SHA-256: `F9AE68496811377D27FC793CE7C109BFB8A3D3B2327E4A24A4C6187CBAE47125`, 208,910 bytes)
- **Política de Despliegue:** **Sin mutación sobre el consumidor activo durante G25.** Toda validación se ejecutó de forma reproducible sobre un clon aislado en staging. La promoción real sobre producción local queda 100 % ensayada, respaldada y lista para activación voluntaria del operador.

---

## 2. Evidencia de Aceptación Técnica en Staging

La suite `.work/experiments/test-g25-inventoryhub-staging-promotion.js` ejecutó las 7 fases obligatorias de calificación:

| Paso | Descripción de la Fase | Resultado | Tiempo |
|---|---|---|---|
| 1 | Verificación criptográfica SHA-256 y tamaño del tarball candidato rc8 | **PASS** | 4 ms |
| 2 | Inicialización de clon aislado e independiente de InventoryHub en sandbox | **PASS** | 15,820 ms |
| 3 | Verificación de línea base: 34 pruebas de negocio pasan en rc4 | **PASS** | 464 ms |
| 4 | Promoción transaccional del candidato rc8 vía `TransactionalPromotionEngine` | **PASS** | 8,400 ms |
| 5 | Conformance de contrato MCP curado (8 herramientas) en staging promovido | **PASS** | 618 ms |
| 6 | Ejecución de las 34 pruebas de negocio de InventoryHub bajo rc8 | **PASS** | 426 ms |
| 7 | Simulacro de rollback transaccional con inyección de fallo y verificación de paridad | **PASS** | 5,032 ms |

**Resultado Global de Staging:** **7 / 7 Fases Aprobadas (100 % Éxito)**.

---

## 3. Desglose de las 34 Pruebas de Negocio del Consumidor

Las 34 pruebas de negocio corresponden a las tres suites funcionales que gobiernan el núcleo de dominio de `InventoryHub`:

1. **`test_inventory_manager.js` (E2E ESM + SQLite):**
   - Creación de lotes FIFO.
   - Consumo parcial y total de lotes.
   - Cálculo exacto de COGS ($1,750).
   - Valoración de inventario remanente ($2,250, costo promedio $150).
   - Persistencia física en base de datos SQLite.
   - **Resultado:** **APROBADO (100 %)**.

2. **`test_phase_2c2_full.js` (24 Verificaciones de Negocio):**
   - Test 1 (11 checks): Baseline FIFO, COGS y valoración multiactiva.
   - Test 2 (4 checks): Transacción ROLLBACK ante intento de déficit de stock (estado intacto con 30 unidades).
   - Test 3 (3 checks): Precisión monetaria en centavos enteros y política de redondeo.
   - Test 4 (4 checks): Estrategia de migración desde JSON legado preservando lotes históricos.
   - Test 5 (2 checks): Reapertura de base de datos entre procesos Node.js independientes sin pérdida.
   - **Resultado:** **24 / 24 APROBADOS (100 %)**.

3. **`test_phase_2c4_post_cleanup.mjs` (10 Verificaciones de Independencia):**
   - Ausencia de dependencia del archivo JSON legado (`inventory-data.json`).
   - Ciclo de vida directo en SQLite.
   - Rollback transaccional ante déficit.
   - Reanudación segura por proceso independiente.
   - **Resultado:** **10 / 10 APROBADOS (100 %)**.

**Total de Pruebas de Negocio:** **34 / 34 Aprobadas (100 % de Compatibilidad Hacia Atrás)**.

---

## 4. Ensayo de Rollback Transaccional (Fase 7)

Se inyectó un fallo simulado en la fase de `SMOKE_TEST` durante un intento de despliegue sobre el clon de staging. El motor `TransactionalPromotionEngine`:
1. Detectó el fallo de inmediato.
2. Transicionó ordenadamente al estado `ROLLED_BACK`.
3. Restauró el archivo `package.json` original con 100 % de paridad de bytes.
4. Restauró el paquete `openmemory` en `node_modules` a la versión `0.3.14-rc4`.
5. Liberó el cerrojo atómico `.promotion.lock`.
6. Re-ejecutó las 34 pruebas de negocio post-rollback, aprobando el 100 %.

---

## 5. Procedimiento para Promoción Activa (Runbook Operativo)

Si el operador desea aplicar la promoción sobre el directorio activo de `InventoryHub`, debe ejecutar el siguiente comando seguro desde la raíz del repositorio:

```powershell
node scripts/transactional-promotion-engine.js `
  --consumer "C:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\InventoryHub" `
  --tarball ".work/artifacts/openmemory-0.3.15-rc8.tgz" `
  --expected-version "0.3.15-rc8" `
  --original-version "0.3.14-rc4"
```
El motor ejecutará preflight, backup automático, sustitución atómica y verificación posterior de humo.
