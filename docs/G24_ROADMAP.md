# ROADMAP ACTUALIZADO DE OPENMEMORY / EVOCARA (G24 -> G25+)
## Prioridades Estratégicas, Dependencias Técnicas, Criterios de Salida y Gestión de Riesgos

- **Fecha de Actualización:** 21 de octubre de 2026
- **Línea Base:** Milestone G24
- **Candidato Calificado:** `openmemory-0.3.15-rc8.tgz` (SHA-256: `F9AE68496811377D27FC793CE7C109BFB8A3D3B2327E4A24A4C6187CBAE47125`)
- **Consumidor Protegido:** `InventoryHub` (En `0.3.14-rc4`, intacto)

---

## 1. Matriz de Prioridades para las Siguientes Fases

| Nivel | Iniciativa / Tarea | Justificación y Beneficio Técnico | Dependencias Críticas | Criterio de Salida (DoD) | Estimación |
|---|---|---|---|---|---|
| **P0** | **Validación Empírica en Sesión Prolongada de OpenCode (G25)** | Certificar la utilidad real de la memoria persistente durante sesiones de programación continuas (50+ interacciones, >30 minutos), evaluando handoffs entre sesiones y compactación automática de eventos en tiempo real. | `0.3.15-rc8.tgz`, entorno OpenCode local, arnés de telemetría de eventos. | Cero fatiga de contexto, cero bloqueos de UI, eventos esenciales (`adr.saved`, `session.registered`) 100 % preservados, latencia sub-5ms. | 2 sesiones de desarrollo |
| **P1** | **Calibración de Umbral Absoluto de No Respondibilidad ($K=0$)** | Introducir un umbral estático de corte (`score >= 0.50`) en `queryKnowledgeItems` para descartar coincidencias fortuitas de baja relevancia en consultas fuera de dominio. | `src/storage.ts`, benchmark de 105 escenarios. | Eliminación de los 5 falsos descubrimientos en consultas imposibles (`G3-UNANS-71` a `75`), False Discovery Rate = 0 %. | 1 bloque técnico |
| **P2** | **Particionamiento Automático por `project_id` en Facade MCP** | Garantizar que el servidor MCP inyecte automáticamente el identificador del proyecto activo en las consultas de `StorageEngine`, evitando filtraciones léxicas en índices multi-proyecto. | `src/mcp.ts`, `src/storage.ts`. | Aislamiento estricto de 5/5 escenarios cross-project (`G3-ISOL-76` a `80`) en sandboxes compartidos. | 1 bloque técnico |
| **P3** | **Promoción Controlada de InventoryHub a `0.3.15-rc8`** | Migrar el consumidor de producción local desde `0.3.14-rc4` a `0.3.15-rc8` mediante el `TransactionalPromotionEngine` para incorporar soporte multilingüe y 40 tools MCP. | Autorización humana formal, superación de la prueba P0 de OpenCode. | Estado `COMMITTED`, 34/34 pruebas de negocio aprobadas en vivo, backup catalogado y verificado. | 1 intervención controlada |

---

## 2. Dependencias Técnicas y Bloqueadores

```
[ G24: Staging Aceptado (rc8) ]
              |
              v
[ P0: Prueba de Sesión Prolongada en OpenCode ] <--- BLOQUEADOR DE PROMOCIÓN A PRODUCCIÓN
              |
              +-----------------------+
              |                       |
              v                       v
[ P1: Umbral K=0 ]          [ P2: Particionamiento project_id ]
              |                       |
              +-----------+-----------+
                          |
                          v
        [ P3: Promoción Controlada en InventoryHub ]
```

- **Bloqueador Principal:** No se promoverá `InventoryHub` activo hasta que se complete la prueba de uso real prolongado en OpenCode (P0), demostrando que la compactación oportunista a 1 MB no degrada el rendimiento de la herramienta ni el contexto del LLM.

---

## 3. Registro de Riesgos Residuales y Mitigaciones

| ID de Riesgo | Descripción del Riesgo Residual | Severidad | Probabilidad | Estrategia de Mitigación |
|---|---|---|---|---|
| **R-G24-01** | **Solapamiento Léxico en Consultas Sin Respuesta:** Consultas con términos genéricos ("standards", "stock") pueden devolver documentos legítimos con puntuaciones marginales ($< 1.0$). | Baja | Media | El score bajo advierte al LLM sobre la débil relevancia. Mitigación definitiva programada en P1 mediante umbral absoluto. |
| **R-G24-02** | **Límites de BM25 ante Paráfrasis Pura sin Cognados:** Consultas que utilicen sinónimos conceptuales sin raíces compartidas tienen menor recall. | Baja | Baja | La decisión de mantener dependencias cero y latencia sub-2ms compensa con creces este límite frente al coste de modelos de embeddings pesados. |
| **R-G24-03** | **Interrupción Forzada en Escrituras NTFS de Windows:** Cortes abruptos durante la rotación del registro de eventos en Windows. | Media | Muy Baja | `PersistenceEngine` utiliza escritura atómica con archivo temporal (`.tmp`) y renombramiento atómico, garantizando que el archivo canónico nunca quede a medio escribir. |

---

## 4. Criterios de Aceptación para la Fase G25

Para declarar cerrada la siguiente iteración (G25), deberán cumplirse obligatoriamente los siguientes hitos:
1. [ ] Ejecutar sesión de trabajo interactiva de 45+ minutos en OpenCode con el plugin OpenMemory v0.3.15-rc8 activo.
2. [ ] Registrar al menos 50 mutaciones de memoria (guardado de ADRs, notas técnicas, registros de investigación y transiciones de fase).
3. [ ] Demostrar que el evento de compactación oportunista se dispara al alcanzar 1 MB sin errores ni pérdida de eventos esenciales.
4. [ ] Verificar que tras cerrar OpenCode y reabrirlo, el handoff y el contexto de memoria se recuperan instantáneamente (latencia $< 50$ ms).
5. [ ] Emitir el informe G25 con la decisión formal de promoción final a producción de `InventoryHub`.
