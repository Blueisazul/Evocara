# Siguiente secuencia por gate

1. **Owner decisions (documental):** completar D-02 exacto; aprobar/editar matriz D-04; cerrar D-07; contestar D-09; ratificar política y comportamiento requerido D-10; resolver D-05/06/08/11/12/13 donde afecte el siguiente gate. Sin esto: no implementación persistente.
2. **Evaluación de driver (solo con D-02):** evaluar únicamente el artefacto/tag, runtime, targets y política de instalación expresamente autorizados. Registrar install/provenance/SBOM. No crear DB; no implica piloto.
3. **Piloto P01–P12 (permiso separado):** levantar explícitamente `DENIED`; confirmar driver/runtime/OS/CPU, contratos, root absoluto nuevo fuera de OneDrive, límites de escritura y comandos; revisar harness y preservación. Si falta algo, `BLOCKED`, no mutar.
4. **Integración CLI/MCP:** después de aceptar piloto y cerrar D-06/D-11; autorización y regresión de consumidores legacy propias. El piloto no la aprueba.
5. **Backup/restore/deletion:** cerrar D-05/D-08/D-12/D-13; pruebas y autorización específicas en destino alterno.
6. **Migración/cutover:** D-04 completo, backups/restores aprobados, reconcile sin conflictos, rollback probado y permiso independiente.
7. **Benchmark:** permiso propio, baseline/candidate inmutables, ledger confiable y umbrales aprobados. No ejecutar histórico.

Primer paso seguro de otra sesión: leer `continuation-prompt.md`, validar Git y buscar respuesta explícita nueva. Evitar repetir auditoría R0–R2.7 o inspección de código sin pregunta concreta.
