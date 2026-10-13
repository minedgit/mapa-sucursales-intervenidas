# Mapa de sucursales intervenidas

Mapa del universo de farmacias de El Salvador con las sucursales intervenidas resaltadas por plan de acción.

**https://mapa-sucursales-intervenidas.vercel.app/**

Vercel (equipo Mined) publica automáticamente cada push a `main`. El sitio es público; las hojas de datos no tienen por qué serlo.

## De dónde salen los datos

El navegador nunca habla con Google. Pide `/api/datos` (`api/datos.js`), una función de Vercel que lee las hojas con una **cuenta de servicio** de Google, solo lectura, y devuelve únicamente los campos que el mapa dibuja.

- **Universo:** la hoja del tablero de farmacias.
- **Planes de acción:** hoja aparte, cruzada por código. Usar `plantilla-planes-de-accion.csv` como base: una fila por plan, columnas `Codigo` y `Plan de accion` obligatorias; el resto (`Estado`, `Fecha`, `Responsable`, `Observaciones`…) aparece tal cual en la ficha de la sucursal.

Cada hoja se comparte como **Lector** con el correo de la cuenta de servicio. No necesitan acceso público.

Vercel guarda el resultado 5 minutos, así que un cambio en las hojas tarda hasta 5 minutos en verse.

## Variables de entorno (Vercel → Settings → Environment Variables)

| Variable | Valor |
|---|---|
| `GOOGLE_SA_EMAIL` | `client_email` del JSON de la cuenta de servicio |
| `GOOGLE_SA_KEY` | `private_key` del mismo JSON, completa, con `-----BEGIN` y `-----END` |
| `UNIVERSO_SHEET_ID` | ID de la hoja del universo (lo que va entre `/d/` y `/edit` en su URL) |
| `PLANES_SHEET_ID` | ID de la hoja de planes. Vacía = modo demostración |
| `UNIVERSO_RANGO`, `PLANES_RANGO` | Opcionales. Por defecto `A:Z` de la primera pestaña; para otra, `NombrePestaña!A:Z` |

**La clave privada nunca va al repositorio, a un chat ni a un correo.** Si se filtra, se borra desde Google Cloud y se genera otra.

Mientras `PLANES_SHEET_ID` esté vacía y el universo no tenga columna de plan, el mapa funciona en **modo demostración** con planes de ejemplo al azar, y lo indica con una franja amarilla.
