# POS + KDS - Local de Hamburguesas

Sistema para tomar pedidos en caja y verlos en tiempo real en cocina.
**Funciona 100% en tu red local, sin necesidad de internet** — y si prefieres, también se
puede desplegar en internet de forma gratuita (ver sección "Desplegar en internet" más abajo).

## ¿Qué incluye?

- **Login por rol:** cada persona entra con su propio usuario y clave. Hay tres roles —
  **cajero** (solo ve Caja), **cocina** (solo ve el KDS) y **administrador** (ve todo,
  incluida la gestión de usuarios y el reporte de ventas).
- **Caja (POS):** pantalla con botones grandes para armar el pedido. Al tocar una hamburguesa
  se abre una ventana para quitar ingredientes que el cliente no quiera (ej. "sin cebolla") y
  agregar una nota adicional (ej. "extra salsa"). Se puede escribir el nombre de quien pide
  el pedido, pero es opcional.
- **Autopedido en mesa:** una pantalla pública (`kiosk.html`) para tablets fijas en las mesas,
  donde el cliente arma su propio pedido indicando el número de mesa. Ese pedido queda
  **esperando pago** — no aparece en cocina hasta que caja confirme el pago desde el panel
  "💳 Por Cobrar".
- **Editar pedidos ya enviados:** con el botón "📋 Pedidos Activos" en caja, se puede volver a
  abrir cualquier pedido que ya esté en cocina (mientras no esté "Entregado") para agregar o
  quitar productos, por si el cliente cambia de opinión.
- **Factura:** al enviar un pedido, confirmar un pago, o guardar cambios, se abre sola una
  ventana con la factura lista para imprimir en tu impresora POS térmica.
- **Cocina (KDS):** pantalla que muestra los pedidos en 3 columnas: Pendientes, En
  preparación, Listos — con la personalización de cada hamburguesa en rojo, el nombre del
  cliente o número de mesa, y una marca "✎ Editado" si el pedido cambió después de enviarse.
- **Administrar Menú:** agregar productos, cambiar nombres, precios e ingredientes, ocultar
  productos que ya no se venden, o eliminarlos (solo si nunca se han usado en un pedido).
- **Usuarios:** el administrador crea, desactiva o cambia la clave de las cuentas de cajero
  y cocina desde `users.html`.
- **Reporte de Ventas:** total vendido, número de pedidos y productos más vendidos en
  cualquier rango de fechas (solo cuenta pedidos ya pagados, no los que están esperando pago).
- Todo se actualiza al instante entre la caja, la cocina y el menú (usa WebSockets).
- Los datos se guardan en una base de datos real (SQLite/Turso), más segura ante cortes de
  luz, reinicios o cierres inesperados que un simple archivo de texto.
- Pantallas optimizadas para usarse desde celulares y tablets, no solo computador.

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

## Primer inicio de sesión

La primera vez que arranca el servidor (`npm start`), si todavía no existe ningún usuario,
se crea automáticamente una cuenta administradora:

- **Usuario:** `admin`
- **Clave:** si definiste `ADMIN_PASSWORD` en tu `.env`, esa; si no, se genera una al azar y
  se muestra **una sola vez** en la terminal donde corre el servidor — cópiala de ahí.

Entra con esa cuenta a `http://localhost:3000/login.html`, y desde `users.html` crea las
cuentas de **cajero** y **cocina** que va a usar el personal (botón "👤 Usuarios" dentro de
Administrar Menú).

## Uso diario

1. En el computador de la caja, dentro de la carpeta, escribir:

   ```
   npm start
   ```

2. Va a aparecer un mensaje con las direcciones disponibles.

3. **Cualquier pantalla del personal** (caja, cocina, administrar, ventas, usuarios) empieza
   por el login: `http://localhost:3000/login.html`. Cada quien entra con su usuario y clave,
   y queda dentro de la pantalla que le corresponde a su rol.

4. **En la tablet de cocina:** conectarla a la misma red WiFi que el computador de la caja
   (o a internet, si desplegaste en línea — ver más abajo), entrar a `login.html` y entrar
   con la cuenta de rol "cocina".

5. Dejar esa pantalla abierta en la tablet durante todo el turno.

6. **Para las tablets de autopedido en las mesas:** no necesitan login. Ábrelas directo en
   `http://localhost:3000/kiosk.html` (o, si quieres dejarla fija en una mesa específica,
   `http://localhost:3000/kiosk.html?mesa=5` para que el número de mesa quede precargado).

7. **Para administrar el menú:** entra con una cuenta de rol "administrador" — desde ahí hay
   enlaces directos a Usuarios, Ventas, Caja y Cocina.

8. **Para ver el reporte de ventas:** `http://localhost:3000/sales.html` (solo administrador).

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

## Autopedido en las mesas (sin login)

Para las tablets que dejas fijas en las mesas, para que el cliente arme su propio pedido:

1. El cliente abre `kiosk.html`, escribe el número de su mesa, arma el pedido igual que en
   caja (con la misma opción de personalizar ingredientes) y toca **"ENVIAR PEDIDO"**.
2. El pedido queda con el estado **"esperando pago"** — todavía NO aparece en cocina.
3. En caja, el botón **"💳 Por Cobrar"** (arriba a la izquierda, con un contador) muestra
   todos los autopedidos esperando pago, con su mesa y sus productos.
4. El cajero cobra al cliente (en efectivo, tarjeta, etc. — eso se maneja fuera del sistema)
   y toca **"Confirmar Pago"**. Ahí el pedido pasa a cocina, se imprime la factura, y ya se ve
   normal en el KDS.

Si dejas varias tablets fijas por mesa, puedes abrir cada una directamente en la mesa que le
corresponde con `kiosk.html?mesa=NÚMERO` (por ejemplo `kiosk.html?mesa=5`), así el cliente no
tiene que escribirlo — aunque igual puede cambiarlo si es necesario.

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
   - `SESSION_SECRET` → cualquier frase larga y única que se te ocurra (protege las sesiones
     de login; no la compartas)
   - `ADMIN_PASSWORD` → la clave que quieres que tenga la cuenta `admin` la primera vez que
     arranque (opcional — si no la pones, se genera una al azar y queda en los logs de
     Northflank, cópiala de ahí)
4. En **Puertos/Networking**, asegúrate de exponer un puerto público (Northflank asigna el
   puerto automáticamente vía la variable `PORT`, que el servidor ya usa).
5. Despliega. Northflank te da una URL pública (algo como
   `https://burger-pos--xxxxx.code.run`).

### Paso 4: Usarla

- **Login (todo el personal empieza aquí):** `https://tu-url.northflank.app/login.html`
- **Autopedido en mesas (sin login):** `https://tu-url.northflank.app/kiosk.html`

Una vez desplegado, cualquier tablet o celular con internet puede usar el sistema desde
cualquier lugar — ya no hace falta estar en la misma WiFi.

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
- Las sesiones de login se guardan en la memoria del propio servidor. Esto es perfecto para
  un solo local con un servidor corriendo (que es el caso normal). Si en el futuro llegaras a
  necesitar más de una instancia del servidor al mismo tiempo (alta escala), habría que mover
  las sesiones a un almacén compartido como Redis — avísame si llegas a ese punto.
