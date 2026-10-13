# Mapa de sucursales intervenidas

Mapa del universo de farmacias de El Salvador con las sucursales intervenidas resaltadas por plan de acción.

## De dónde salen los datos

- **Universo:** la hoja de Google Sheets del tablero de farmacias (`UNIVERSO.sheetId` en `index.html`).
- **Planes de acción:** una hoja aparte, cruzada por código (`PLANES.sheetId`). Usar `plantilla-planes-de-accion.csv` como base: una fila por plan, columnas `Codigo` y `Plan de accion` obligatorias; `Estado`, `Fecha`, `Responsable` y `Observaciones` opcionales.

Ambas hojas deben estar compartidas como "Cualquier persona con el enlace". El mapa se actualiza solo cada 5 minutos.

Mientras `PLANES.sheetId` esté vacío y la hoja del universo no tenga columna de plan, el mapa funciona en **modo demostración** con planes de ejemplo asignados al azar, y lo indica con una franja amarilla.

## Publicación

GitHub Pages desde la rama `main`. El sitio es público.
