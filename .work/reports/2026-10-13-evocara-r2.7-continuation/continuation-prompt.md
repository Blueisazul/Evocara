# Evocara R2.7 — checkpoint autocontenido

## Checkout y preservación

Checkout: `.`; preflight R2.7 observó `master`, HEAD `4ab1463446c72bd557f3a6d340285259743f23e9`. Siete rutas rastreadas siguen modificadas: `.openmemory/spike/events.jsonl`, `.openmemory/spike/state.json`, `.work/evidence/opencode-compaction-payload.json`, `.work/evidence/phase-2-spike-results.json`, `.work/evidence/phase-3.5-e2e-test-results.json`, `.work/evidence/phase-4.3-installer-test-results.json`, `.work/evidence/phase-4.5-benchmark-test-results.json`. Se leyeron solo sus nombres en `git status`, no su contenido. Preservarlas. No acceder a InventoryHub ni datos personales.

## Autorizaciones

- D-01 híbrida: `APPROVED_WITH_LIMITS`; JSON/Markdown sigue authority hasta cutover aprobado.
- D-02: `PENDING_OWNER_APPROVAL`; `better-sqlite3` v13.0.3 sigue candidato de evaluación, no selección.
- D-03: evaluación sintética local no-synced prevista; no certifica FS, OneDrive excluido.
- D-04 entidad: `PENDING_OWNER_APPROVAL`.
- D-05, D-06, D-08, D-09, D-11–D-14: pendientes (D-14 diferible).
- D-07: CAS `APPROVED_WITH_LIMITS` solo como requisito, no implementación.
- D-10: fail-closed `APPROVED_WITH_LIMITS` como target únicamente.
- Piloto file-backed: `DENIED`; P01–P12 `NOT RUN`.

## Trabajo R2.7 completado

Preflight read-only coincide con referencia. Leídos los cuatro docs requeridos de R2.6; no se encontró respuesta explícita nueva. No se reabrió código. Se creó únicamente `.work/reports/2026-10-13-evocara-r2.7-continuation/` con reporte, matriz D-01…D-14/P01…P12, revisión de dependencias, próximos pasos, este prompt y manifiesto de verificación. El diseño técnico está en `implementation-design.md` de R2.6.

## Siguiente acción concreta

Revisar si el propietario respondió en una fuente nueva/expresa. Resolver D-02 primero para habilitar, como mucho, evaluación de driver. Para DB/P01–P12 se requiere permiso separado que levante la denegación y cierre driver/runtime/root/contratos. No instalar, crear DB ni probar persistencia mientras falte permiso. Integración, restore, borrado, cutover y benchmark requieren gates separados.

Fuentes prioritarias: este `decision-register.md`/`traceability-matrix.md`; luego R2.6 `implementation-design.md`; gate P01–P12 R2.4.1 solo si se va a preparar piloto autorizado. No rehacer auditoría R0–R2.6 ni inspección de código sin pregunta técnica nueva.

Condiciones de parada: HEAD/branch inesperados; cambios locales distintos que no puedan preservarse; aprobación ambigua; root dentro de OneDrive; cualquier riesgo de escribir en `.openmemory/`, InventoryHub o evidencia histórica.
