# POS + KDS - Local de Hamburguesas

Sistema para tomar pedidos en caja y verlos en tiempo real en cocina.
**Funciona 100% en tu red local, sin necesidad de internet** — y si prefieres, también se
puede desplegar en internet de forma gratuita (ver sección "Desplegar en internet" más abajo).

## ¿Qué incluye?

- **Caja (POS):** pantalla con botones grandes para armar el pedido. Al tocar una hamburguesa
  se abre una ventana para quitar ingredientes que el cliente no quiera (ej. "sin cebolla") y
  agregar una nota adicional (ej. "extra salsa"). Se puede escribir el nombre de quien pide
  el pedido, pero es opcional.
- **Editar pedidos ya enviados:** con el botón "📋 Pedidos Activos" en caja, se puede volver a
  abrir cualquier pedido que ya esté en cocina (mientras no esté "Entregado") para agregar o
  quitar productos, por si el cliente cambia de opinión.
- **Factura:** al enviar o guardar un pedido, se abre sola una ventana con la factura lista
  para imprimir en tu impresora POS térmica (lanza el diálogo de impresión automáticamente).
- **Cocina (KDS):** pantalla para tablet que muestra los pedidos en 3 columnas: Pendientes, En
  preparación, Listos — con la personalización de cada hamburguesa en rojo, el nombre del
  cliente si se indicó, y una marca "✎ Editado" si el pedido cambió después de enviarse.
- **Administrar Menú:** pantalla para agregar productos, cambiar nombres, precios e
  ingredientes, ocultar productos que ya no se venden, o eliminarlos (solo si nunca se han
  usado en un pedido).
- **Reporte de Ventas:** pantalla con el total vendido, número de pedidos y productos más
  vendidos en cualquier rango de fechas (accesos rápidos a "Hoy", "Últimos 7 días" y "Este mes").
- Todo se actualiza al instante entre la caja, la cocina y el menú (no hay que refrescar la
  pantalla — usa WebSockets, así que los cambios se ven en el momento).
- Los datos se guardan en una base de datos real (SQLite, un solo archivo `burger-pos.db` en esta
  misma carpeta), más segura ante cortes de luz o cierres inesperados que un simple archivo de texto.

## Requisitos

Instalar **Node.js** (versión 18 o superior) en el computador que va a hacer de "servidor"
(normalmente el computador de la caja). Se descarga gratis desde: https://nodejs.org
(elegir la versión "LTS" y hacer clic en "Siguiente" hasta terminar la instalación).

## Instalación (solo se hace una vez)

1. Copiar toda esta carpeta `burger-pos` al computador de la caja.
2. Abrir la carpeta y, dentro de ella, abrir una terminal (en Windows: clic derecho dentro
   de la carpeta y elegir "Abrir en Terminal" o "Abrir ventana de PowerShell aquí").
3. Escribir este comando y presionar Enter:

   ```
   npm install
   ```

   Esto descarga lo necesario para que el programa funcione. Solo se hace una vez.

## Uso diario

1. En el computador de la caja, dentro de la carpeta, escribir:

   ```
   npm start
   ```

2. Va a aparecer un mensaje como este:

   ```
   Caja (este equipo): http://localhost:3000/pos.html
   Cocina (tablet, misma WiFi): http://192.168.1.X:3000/kds.html
   ```

3. **En el computador de la caja:** abrir un navegador (Chrome, Edge, etc.) y entrar a
   `http://localhost:3000/pos.html`

4. **En la tablet de cocina:** conectarla a la misma red WiFi que el computador de la caja,
   abrir el navegador y escribir la dirección que aparece en el mensaje junto a "Cocina"
   (la que empieza por `http://192.168...`). Esa dirección puede variar según la red;
   siempre va a ser la que muestre el mensaje al iniciar.

5. Dejar esa pantalla abierta en la tablet durante todo el turno.

6. **Para administrar el menú:** entrar a `http://localhost:3000/admin.html` desde el
   computador de la caja (o cualquier equipo en la misma red). Ahí se pueden agregar
   productos, cambiar precios, ocultar los que no se venden hoy o eliminarlos. También hay
   un pequeño ícono de engranaje (⚙️) en la esquina inferior derecha de la pantalla de caja
   que lleva directo a esta pantalla — está discreto a propósito para no confundir a quien
   está cobrando.

7. **Para ver el reporte de ventas:** entrar a `http://localhost:3000/sales.html`, o tocar
   el ícono 📊 junto al de engranaje en la pantalla de caja.

## Editar un pedido ya enviado a cocina

Si el cliente quiere agregar o quitar algo después de haber enviado el pedido:

1. En caja, tocar el botón **"📋 Pedidos Activos"** (arriba a la derecha).
2. Elegir el pedido de la lista y tocar **"Editar"**.
3. El pedido se carga en el carrito — se pueden agregar productos nuevos o quitar los que
   ya no se quieren, igual que al armar un pedido normal.
4. Tocar **"GUARDAR CAMBIOS"**. El KDS se actualiza al instante con los cambios, marcado con
   **"✎ Editado"**, y se abre una factura nueva con el pedido actualizado.

Un pedido que ya fue marcado como "Entregado" en cocina no se puede editar (para proteger
el historial de ventas ya cerradas).

## Desplegar en internet (Northflank + Turso, gratis)

Esta app también puede vivir en internet en vez de en el computador de la caja, para que la
caja, la cocina y las ventas se puedan ver desde cualquier lugar sin instalar nada. Se usa:

- **Turso**: base de datos gratuita y permanente (los datos NO se pierden si el servidor se
  reinicia — a diferencia de guardar todo en un archivo dentro del propio servidor).
- **Northflank**: hospedaje del servidor, con un plan gratuito que se mantiene siempre
  encendido (pide una tarjeta solo para verificar identidad, no cobra nada del plan gratis).

### Paso 1: Crear la base de datos en Turso

1. Entra a https://turso.tech y crea una cuenta gratis (no pide tarjeta).
2. Instala su herramienta de línea de comandos o usa el panel web para crear una base de
   datos nueva (por ejemplo, llamada `burger-pos`).
3. Turso te da dos datos que vas a necesitar: la **URL de la base de datos** (empieza por
   `libsql://...`) y un **Auth Token**. Guárdalos, los vas a pegar en Northflank.

### Paso 2: Subir el proyecto a GitHub

Northflank despliega desde un repositorio de Git. Sube esta carpeta a un repositorio nuevo
en GitHub (puede ser privado). El archivo `.gitignore` ya está configurado para no subir
`node_modules` ni archivos de base de datos locales.

### Paso 3: Crear el servicio en Northflank

1. En Northflank, crea un nuevo **servicio** y conéctalo a tu repositorio de GitHub.
2. Método de construcción: elige **Buildpack** (no necesitas Dockerfile; Northflank detecta
   que es Node.js automáticamente por el `package.json`). Si prefieres, el proyecto también
   incluye un `Dockerfile` por si quieres construir así en su lugar.
3. En **Variables de entorno**, agrega:
   - `TURSO_DATABASE_URL` → la URL que te dio Turso
   - `TURSO_AUTH_TOKEN` → el token que te dio Turso
4. En **Puertos/Networking**, asegúrate de exponer un puerto público (Northflank asigna el
   puerto automáticamente vía la variable `PORT`, que el servidor ya usa).
5. Despliega. Northflank te da una URL pública (algo como
   `https://burger-pos--xxxxx.code.run`).

### Paso 4: Usarla

- **Caja:** `https://tu-url.northflank.app/pos.html`
- **Cocina:** `https://tu-url.northflank.app/kds.html` (en cualquier tablet con internet,
  ya no hace falta que esté en la misma WiFi que la caja)
- **Administrar menú:** `https://tu-url.northflank.app/admin.html`
- **Ventas:** `https://tu-url.northflank.app/sales.html`

### Probar localmente con Turso antes de desplegar (opcional)

Si quieres probar la conexión a Turso desde tu computador antes de desplegar:

1. Copia `.env.example` a un archivo nuevo llamado `.env`.
2. Pega ahí tu `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN`.
3. Corre `npm start` como siempre — el mensaje al iniciar te confirma si está usando
   "Turso (remota)" o "archivo local".

Si no creas el archivo `.env`, la app sigue funcionando igual que siempre, guardando todo en
un archivo local — perfecto para seguir probando cambios sin tocar los datos de producción.

> Tip: en la tablet, se puede "Agregar a pantalla de inicio" desde el navegador para que
> quede como si fuera una aplicación normal.

## Impresora de facturas

Al enviar un pedido se abre sola una ventana con la factura y el diálogo de impresión.
Elige ahí tu impresora POS como destino (el navegador recuerda la elección, así que después
de la primera vez queda prácticamente automático). No necesita ningún driver especial: usa
la impresión normal del navegador, así que funciona con cualquier impresora térmica que esté
instalada como impresora de Windows/Mac.

- El nombre del local que aparece en la factura se cambia editando la constante
  `NOMBRE_LOCAL` al inicio de `public/receipt.js`.
- La factura está pensada para papel de 80mm. Si tu impresora usa papel de 58mm, cambia
  `80mm` por `58mm` en `public/receipt.css` (`.factura { width: ... }` y `@page { size: ... }`).
- Si el navegador bloquea la ventana emergente la primera vez, hay que permitir "ventanas
  emergentes" para esta página una sola vez.

## Personalización de ingredientes

- Al crear o editar un producto en **Administrar Menú**, se puede escribir la lista de
  ingredientes separados por coma (ej. `Pan, Carne, Queso, Lechuga, Tomate, Cebolla`).
- Solo los productos con ingredientes cargados abren la ventana de personalización en caja.
  Los productos sin ingredientes (bebidas, extras) se agregan directo, como antes.
- Lo que el cajero desmarque se guarda como nota del pedido y aparece en la factura y en el KDS.

## Para cerrar el sistema

En la terminal donde está corriendo, presionar `Ctrl + C`.

## Notas

- Los pedidos y el menú se guardan automáticamente en un archivo `burger-pos.db` (base de
  datos SQLite) que se crea dentro de esta misma carpeta la primera vez que se inicia el
  programa. No se debe borrar ese archivo si se quiere conservar el historial de pedidos.
- Un producto que ya fue vendido alguna vez no se puede eliminar (para no perder el
  historial de esa venta); en ese caso, el sistema solo permite ocultarlo del menú de caja.
- El computador de la caja debe permanecer encendido mientras el local esté abierto, ya que
  es el que hace de "servidor" para la tablet.
- Si Windows pregunta si permitir el acceso de Node.js a la red al iniciar por primera vez,
  hay que elegir "Permitir acceso" (necesario para que la tablet se pueda conectar).
