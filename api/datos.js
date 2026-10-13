// Intermediario entre el mapa y Google Sheets.
// Las hojas no necesitan ser publicas: se leen con una cuenta de servicio cuya
// clave vive solo en las variables de entorno de Vercel. Al navegador llegan
// unicamente los campos que el mapa dibuja (ni telefonos ni tipo de contrato).
const crypto = require("crypto");

const UNIVERSO_ID = process.env.UNIVERSO_SHEET_ID;
const UNIVERSO_RANGO = process.env.UNIVERSO_RANGO || "A:Z";   // sin nombre de pestana = la primera
const PLANES_ID = process.env.PLANES_SHEET_ID || "";
const PLANES_RANGO = process.env.PLANES_RANGO || "A:Z";

const norm = s => (s ?? "").toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
const b64url = b => Buffer.from(b).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

// El token dura una hora; se reutiliza mientras la funcion siga caliente
let tokenCache = { valor: null, vence: 0 };

async function obtenerToken() {
  if (tokenCache.valor && Date.now() < tokenCache.vence) return tokenCache.valor;
  const email = process.env.GOOGLE_SA_EMAIL;
  // Vercel guarda los saltos de linea de la clave como "\n" literales
  const clave = (process.env.GOOGLE_SA_KEY || "").replace(/\\n/g, "\n");
  if (!email || !clave) throw new Error("Faltan GOOGLE_SA_EMAIL o GOOGLE_SA_KEY en Vercel");

  const ahora = Math.floor(Date.now() / 1000);
  const cabecera = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const cuerpo = b64url(JSON.stringify({
    iss: email,
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",   // solo lectura, aunque la hoja se comparta como editor
    aud: "https://oauth2.googleapis.com/token",
    iat: ahora, exp: ahora + 3600
  }));
  const firma = b64url(crypto.createSign("RSA-SHA256").update(`${cabecera}.${cuerpo}`).sign(clave));

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${cabecera}.${cuerpo}.${firma}` })
  });
  if (!res.ok) throw new Error(`Google rechazo la cuenta de servicio (${res.status}). Revisar GOOGLE_SA_EMAIL y GOOGLE_SA_KEY`);
  const { access_token, expires_in } = await res.json();
  tokenCache = { valor: access_token, vence: Date.now() + (expires_in - 120) * 1000 };
  return access_token;
}

async function leerHoja(id, rango, token, nombre) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(rango)}?valueRenderOption=FORMATTED_VALUE`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 403 || res.status === 404) throw new Error(`La hoja de ${nombre} no esta compartida con la cuenta de servicio`);
  if (!res.ok) throw new Error(`No se pudo leer la hoja de ${nombre} (${res.status})`);
  const filas = (await res.json()).values || [];
  if (!filas.length) return [];
  const enc = filas[0].map(norm);
  // Busca la columna por coincidencia parcial del encabezado, tolerante a tildes y orden
  const idx = (...pistas) => enc.findIndex(h => pistas.some(p => h.includes(p)));
  return { enc: filas[0], idx, filas: filas.slice(1).filter(f => f.some(c => String(c).trim())) };
}

const celda = (f, i) => (i < 0 ? "" : String(f[i] ?? "").trim());

module.exports = async (req, res) => {
  try {
    if (!UNIVERSO_ID) throw new Error("Falta UNIVERSO_SHEET_ID en Vercel");
    const token = await obtenerToken();

    const u = await leerHoja(UNIVERSO_ID, UNIVERSO_RANGO, token, "universo");
    const c = {
      codigo: u.idx("codigo"), nombre: u.idx("nombre"), proveedor: u.idx("proveedor"),
      estatus: u.idx("estatus", "estado"), municipio: u.idx("municipio"), departamento: u.idx("departamento"),
      direccion: u.idx("direccion"), lat: u.idx("latitud"), lon: u.idx("longitud"), plan: u.idx("plan")
    };
    const sucursales = u.filas.map(f => Object.fromEntries(Object.entries(c).map(([k, i]) => [k, celda(f, i)])));

    let planes = null;   // null = no hay hoja de planes configurada
    if (PLANES_ID) {
      const p = await leerHoja(PLANES_ID, PLANES_RANGO, token, "planes de accion");
      const iCod = p.idx("codigo"), iPlan = p.idx("plan");
      if (iCod < 0 || iPlan < 0) throw new Error("La hoja de planes necesita las columnas Codigo y Plan de accion");
      // El resto de columnas (Estado, Fecha, Responsable...) se muestran tal cual en la ficha
      const extras = p.enc.map((h, i) => i).filter(i => i !== iCod && i !== iPlan && String(p.enc[i]).trim());
      planes = p.filas.map(f => ({
        codigo: celda(f, iCod), plan: celda(f, iPlan),
        detalle: extras.map(i => ({ label: String(p.enc[i]).trim(), value: celda(f, i) })).filter(d => d.value)
      })).filter(x => x.codigo && x.plan);
    }

    // Cache en el borde de Vercel: Google no recibe mas de una lectura cada 5 minutos
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=60");
    res.status(200).json({ sucursales, planes, generado: new Date().toISOString() });
  } catch (e) {
    console.error(e);
    res.setHeader("Cache-Control", "no-store");
    res.status(500).json({ error: e.message });
  }
};
