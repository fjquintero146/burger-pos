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
- **Autopedido:** una pantalla pública (`kiosk.html`) para tablets en el local, donde el
  cliente arma su propio pedido y le pone un nombre (para identificarlo, no un número de
  mesa). Ese pedido queda
  **esperando pago** — no aparece en cocina hasta que caja confirme el pago desde el panel
  "💳 Por Cobrar".
- **Tipo de pedido:** cada pedido se marca como 🍽️ Mesa, 🥡 Para Llevar, o 🛵 Domicilio —
  visible en el KDS y en la factura.
- **Pantalla pública de pedidos listos:** `listos.html`, pensada para un TV o tablet a la
  vista de los clientes — muestra los números de pedido en cuanto cocina los marca "Listo",
  y los quita solos cuando se entregan.
- **Editar pedidos ya enviados:** con el botón "📋 Pedidos Activos" en caja, se puede volver a
  abrir cualquier pedido que ya esté en cocina (mientras no esté "Entregado") para agregar o
  quitar productos, por si el cliente cambia de opinión.
- **Anular pedidos:** con motivo obligatorio, desde "Pedidos Activos" o "Por Cobrar". El
  pedido no se borra, queda en el histórico marcado como anulado (con quién y por qué), deja
  de contar como venta, y el administrador puede ver todas las anulaciones en el reporte.
- **Factura:** al enviar un pedido, confirmar un pago, o guardar cambios, se abre sola una
  ventana con la factura lista para imprimir en tu impresora POS térmica.
- **Cocina (KDS):** pantalla que muestra los pedidos en 3 columnas: Pendientes, En
  preparación, Listos — con la personalización de cada hamburguesa en rojo, el nombre del
  cliente o el nombre puesto en el autopedido, y una marca "✎ Editado" si el pedido cambió
  después de enviarse.
- **Administrar Menú:** agregar productos, cambiar nombres, precios e ingredientes, ocultar
  productos que ya no se venden, o eliminarlos (solo si nunca se han usado en un pedido). Cada
  producto puede tener una foto o ícono, para que el personal identifique el pedido sin
  necesidad de leer.
- **Usuarios:** el administrador crea, desactiva o cambia la clave de las cuentas de cajero
  y cocina desde `users.html`.
- **Configuración:** el administrador sube el logo del negocio, el nombre que aparece en caja
  y factura, y elige el ancho de papel de la impresora (58mm o 80mm) desde `settings.html`.
- **Reporte de Ventas:** total vendido, número de pedidos y productos más vendidos en
  cualquier rango de fechas (solo cuenta pedidos ya pagados, no los que están esperando pago),
  con desglose por método de pago, por hora del día (para planear personal), por cajero, y
  tiempo promedio de preparación de los pedidos.
- **Arqueo de caja:** apertura de turno con base inicial, y cierre con conteo físico de
  efectivo — el sistema calcula solo si sobra o falta dinero. Historial completo para el
  administrador en `turnos.html`. Al cerrar, se puede enviar automáticamente un PDF del
  cierre por correo para que alguien lo valide.
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

6. **Para las tablets de autopedido:** no necesitan login. Ábrelas directo en
   `http://localhost:3000/kiosk.html` (o, si quieres dejarla con un nombre precargado,
   `http://localhost:3000/kiosk.html?nombre=Camilo`).

7. **Para administrar el menú:** entra con una cuenta de rol "administrador" — desde ahí hay
   enlaces directos a Usuarios, Configuración, Ventas, Caja y Cocina.

8. **Para ver el reporte de ventas:** `http://localhost:3000/sales.html` (solo administrador).

9. **Para configurar el logo, nombre del local y tamaño de papel:**
   `http://localhost:3000/settings.html` (solo administrador).

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

## Anular un pedido

Para cuando el cliente se arrepiente, se va sin pagar, o hay un error que no se soluciona
editando: desde el panel **"📋 Pedidos Activos"** o **"💳 Por Cobrar"**, cada pedido tiene un
botón **"Anular"**.

- Pide un **motivo obligatorio** — no se puede anular sin explicar por qué.
- El pedido **no se borra**: queda guardado con la marca "anulado", quién lo anuló y cuándo.
- Desaparece de cocina al instante y **no cuenta como venta** en el reporte ni en el arqueo
  de caja.
- Un pedido ya anulado no se puede editar ni volver a anular.
- El administrador puede ver todas las anulaciones (con motivo y responsable) en la sección
  "Pedidos anulados" del reporte de ventas — útil para detectar patrones o abuso.

## Autopedido (sin login)

Para las tablets que dejas disponibles en el local, para que el cliente arme su propio pedido:

1. El cliente abre `kiosk.html`, escribe su nombre (para identificar el pedido), arma el
   pedido igual que en caja (con la misma opción de personalizar ingredientes) y toca
   **"ENVIAR PEDIDO"**.
2. El pedido queda con el estado **"esperando pago"** — todavía NO aparece en cocina.
3. En caja, el botón **"💳 Por Cobrar"** (arriba a la izquierda, con un contador) muestra
   todos los autopedidos esperando pago, con el nombre y los productos.
4. El cajero cobra al cliente (en efectivo, tarjeta, etc. — eso se maneja fuera del sistema)
   y toca **"Confirmar Pago"**. Ahí el pedido pasa a cocina, se imprime la factura, y ya se ve
   normal en el KDS.

Si quieres dejar una tablet con un nombre precargado (por ejemplo, un punto fijo de
autopedido), puedes abrirla con `kiosk.html?nombre=NOMBRE` — aunque el cliente igual puede
cambiarlo si lo necesita.

## Tipo de pedido

Tanto en caja como en el kiosco, antes de armar el pedido se elige el tipo:

- 🍽️ **Mesa** — el cliente come en el local (esta es la opción por defecto en el kiosco).
- 🥡 **Para Llevar** — se lo lleva (por defecto en caja).
- 🛵 **Domicilio** — se envía a una dirección (solo disponible desde caja).

El tipo se ve en cada tarjeta del KDS (con su ícono) y queda impreso en la factura.

## Pantalla pública de pedidos listos

Para que los clientes vean cuándo su pedido está listo sin tener que preguntar en el mostrador:

1. Abre `listos.html` en una tablet o TV a la vista del público (no necesita iniciar sesión).
   Desde caja, el ícono 📺 en la esquina abre esta pantalla en una pestaña nueva.
2. En cuanto cocina marca un pedido como **"Listo"** en el KDS, el número aparece solo en
   esta pantalla, con su tipo (mesa/para llevar/domicilio) y el nombre si lo tiene.
3. Cuando se entrega el pedido (botón "Entregado" en el KDS), desaparece solo de la pantalla.

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
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` → opcional, solo si
     quieres que el cierre de caja se mande por correo (ver la sección "Enviar el cierre de
     caja por correo" más abajo)
4. En **Puertos/Networking**, asegúrate de exponer un puerto público (Northflank asigna el
   puerto automáticamente vía la variable `PORT`, que el servidor ya usa).
5. Despliega. Northflank te da una URL pública (algo como
   `https://burger-pos--xxxxx.code.run`).

### Paso 4: Usarla

- **Login (todo el personal empieza aquí):** `https://tu-url.northflank.app/login.html`
- **Autopedido (sin login):** `https://tu-url.northflank.app/kiosk.html`

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

## Arqueo de caja (apertura y cierre de turno)

Antes de empezar a cobrar, el cajero abre turno declarando cuánto efectivo hay de base en la
caja. Al terminar el turno, cuenta el efectivo físico y el sistema le dice si cuadra:

1. En caja, tocar el botón **"🧾 Abrir Turno"** (arriba) y escribir la base inicial en efectivo.
2. Durante el turno, cada venta en efectivo se va sumando automáticamente a lo que debería
   haber en la caja (las ventas con tarjeta, Nequi, etc. no afectan el efectivo físico).
3. Al terminar, tocar **"🧾 Turno abierto"** → **"Cerrar Turno"**. Ahí se ve el desglose de
   ventas por método de pago y el efectivo esperado.
4. Contar el efectivo real de la caja y escribirlo. El sistema calcula la diferencia
   (sobrante o faltante) automáticamente.
5. Solo puede haber **un turno abierto a la vez** — si alguien más intenta abrir otro, el
   sistema se lo impide hasta que el turno actual se cierre.
6. El administrador puede ver el historial completo de turnos cerrados (con quién los abrió,
   quién los cerró, y la diferencia de cada uno) en **`turnos.html`** ("🧾 Turnos" en el menú).
7. Al cerrar, si configuraste el correo de validación (ver siguiente sección), se genera un
   PDF con el resumen del cierre y se envía automáticamente por correo.

## Enviar el cierre de caja por correo (PDF)

Cada vez que se cierra un turno, el sistema puede mandar automáticamente un PDF con el
resumen (base, ventas por método de pago, efectivo esperado vs. contado, diferencia) a un
correo para que alguien lo valide — el dueño, un contador, etc.

### Paso 1: Elegir a dónde llega el correo

En **Configuración** (`settings.html`, solo administrador) hay un campo "Correo destino"
dentro de la sección "Correo del cierre de caja". Ahí escribes la dirección que debe
recibir el PDF cada vez que se cierre un turno.

### Paso 2: Configurar el envío de correos (variables de entorno)

El servidor necesita saber con qué cuenta de correo enviar. La opción más simple y gratis es
usar una cuenta de Gmail con una "contraseña de aplicación" (no tu contraseña normal):

1. Entra a tu cuenta de Gmail → Gestionar tu cuenta de Google → Seguridad.
2. Activa la verificación en dos pasos si no la tienes.
3. Busca "Contraseñas de aplicaciones" y crea una nueva (elige "Otra" y ponle un nombre
   como "Burger POS"). Te va a dar una contraseña de 16 letras — cópiala.
4. Agrega estas variables de entorno (en tu `.env` para probar local, o en Northflank para
   producción, igual que hiciste con `TURSO_DATABASE_URL`):

   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=tu-correo@gmail.com
   SMTP_PASS=la-contraseña-de-aplicación-de-16-letras
   SMTP_FROM=tu-correo@gmail.com
   ```

Si prefieres usar otro proveedor (Outlook, un correo corporativo, o un servicio como
Brevo/Resend/SendGrid), funciona igual: solo cambia `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` y
`SMTP_PASS` por los datos que te dé ese proveedor.

**Si no configuras estas variables, el sistema sigue funcionando exactamente igual** — el
cierre de turno nunca falla por un problema de correo; simplemente no se envía nada, y te lo
avisa en la pantalla ("⚠️ no se pudo enviar el correo...").

## Impresora de facturas

Al enviar un pedido, confirmar un pago, o guardar cambios, se abre sola una ventana con la
factura y el diálogo de impresión. Elige ahí tu impresora POS como destino (el navegador
recuerda la elección, así que después de la primera vez queda prácticamente automático). No
necesita ningún driver especial: usa la impresión normal del navegador, así que funciona con
cualquier impresora térmica que esté instalada como impresora de Windows/Mac.

- El nombre del local y el ancho del papel (58mm u 80mm) se configuran desde `settings.html`
  (solo administrador) — no hace falta tocar ningún archivo.
- Si el navegador bloquea la ventana emergente la primera vez, hay que permitir "ventanas
  emergentes" para esta página una sola vez.

## Marca del local: logo, nombre e íconos de productos

Desde `settings.html` (ícono ⚙️ "Configuración", solo administrador):

- **Logo:** se sube una imagen (se ajusta sola de tamaño) y aparece en el encabezado de caja,
  del kiosco de autopedido, y arriba en la factura impresa.
- **Nombre del local:** reemplaza el texto genérico "Toma de Pedidos" / "Haz tu Pedido" en el
  encabezado, y aparece en la factura.
- **Tamaño de papel:** 58mm u 80mm — la factura se ajusta sola al elegido.

Además, cada producto del menú puede tener su propia foto o ícono (botón "Foto" en
**Administrar Menú**, tanto al crear un producto como en los ya existentes). Esa imagen
aparece en los botones de caja y del kiosco, para que se reconozca el producto de un vistazo
sin tener que leer el nombre — útil tanto para personal que no lee con facilidad como para
que sea más rápido de usar en general. Un producto sin foto sigue funcionando igual que
antes, solo con texto.

## Personalización de ingredientes

- Al crear o editar un producto en **Administrar Menú**, se puede escribir la lista de
  ingredientes separados por coma (ej. `Pan, Carne, Queso, Lechuga, Tomate, Cebolla`).
- Solo los productos con ingredientes cargados abren la ventana de personalización en caja.
  Los productos sin ingredientes (bebidas, extras) se agregan directo, como antes.
- Lo que el cajero desmarque se guarda como nota del pedido y aparece en la factura y en el KDS.

## Modo SaaS: varios restaurantes, cada uno con su propio subdominio

Todo lo de arriba describe el modo "un solo restaurante" (la forma en que empezó este
proyecto). También se puede correr como un SaaS completo donde cualquiera se registra solo,
paga con tarjeta, y obtiene su propio restaurante aislado en `turestaurante.tuapp.com`.

**Este modo es opcional.** Si no defines la variable `APP_DOMAIN`, el servidor funciona
exactamente igual que siempre, como un solo restaurante. Solo se activa el modo SaaS si la
defines.

### Cómo funciona por dentro

- Cada restaurante tiene su **propia base de datos** en Turso (no comparten nada entre sí —
  ni menú, ni pedidos, ni usuarios). Cuando alguien se registra, el sistema le crea su base
  de datos automáticamente.
- Hay una base de datos "central" aparte (`central-db.js`) que solo guarda el directorio de
  qué restaurantes existen y a cuál base de datos conectarse — nunca datos de pedidos.
- El subdominio de la URL (`burgerhouse.tuapp.com`) le dice al servidor a qué restaurante
  conectarse en cada solicitud. Las sesiones de login quedan atadas a un solo restaurante —
  ni por accidente se puede usar la sesión de un restaurante en otro (esto está reforzado
  tanto por el navegador como por el propio servidor, y quedó probado).

### Paso 1: Comprar un dominio y apuntarlo

Compra un dominio (Namecheap, GoDaddy, etc. — unos $10-15 USD/año) y configura en tu
proveedor de DNS:
- Un registro **A** o **CNAME** para el dominio raíz (`tuapp.com`) apuntando a Northflank.
- Un registro **CNAME comodín**: `*.tuapp.com` apuntando también a Northflank, para que
  CUALQUIER subdominio (el que sea) llegue a tu servidor.

Luego, en Northflank, agrega `tuapp.com` **y** `*.tuapp.com` como dominios personalizados de
tu servicio (Northflank emite el certificado HTTPS automáticamente para ambos).

### Paso 2: Variables de entorno nuevas

Además de las que ya tenías (`SESSION_SECRET`, `SMTP_*`, etc.), agrega:

```
APP_DOMAIN=tuapp.com
TURSO_CENTRAL_DATABASE_URL=libsql://...   (crea otra base en Turso, solo para esto)
TURSO_CENTRAL_AUTH_TOKEN=...
TURSO_PLATFORM_TOKEN=...   (token de tu ORGANIZACIÓN en Turso, no de una base — Settings → API Tokens)
TURSO_ORG=tu-organizacion-en-turso
```

Sin `TURSO_PLATFORM_TOKEN`/`TURSO_ORG`, el registro de restaurantes nuevos no va a poder
crear bases de datos automáticamente (te lo va a avisar con un error claro en vez de fallar
en silencio).

### Paso 3: Configurar Stripe (cobro automático)

1. Crea una cuenta gratis en https://dashboard.stripe.com.
2. Ve a **Products** → crea un producto con un precio **recurrente mensual** (ej. "Plan
   Restaurante — $50.000 COP/mes"). Copia el ID del precio (empieza con `price_...`).
3. Ve a **Developers → API keys** y copia tu clave secreta (`sk_...`).
4. Ve a **Developers → Webhooks** → **Add endpoint**, con la URL
   `https://tuapp.com/webhook/stripe`, escuchando los eventos `checkout.session.completed` y
   `customer.subscription.updated`/`.deleted`. Copia el "Signing secret" (`whsec_...`).
5. Agrega estas variables de entorno:

   ```
   STRIPE_SECRET_KEY=sk_...
   STRIPE_PRICE_ID=price_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   STRIPE_TRIAL_DAYS=14
   ```

**Si todavía no configuras Stripe, el registro sigue funcionando** — cada restaurante nuevo
se activa gratis automáticamente (útil para probar todo el flujo antes de empezar a cobrar).

### Paso 4: Probar el registro de un restaurante nuevo

Entra a `https://tuapp.com/registro.html`, completa el formulario (nombre del restaurante,
subdominio deseado, tu correo, una clave), y confirma el pago si ya configuraste Stripe. En
unos segundos tu restaurante queda listo en `https://elsubdominioquepusiste.tuapp.com`.

### Lo que falta para tener el SaaS 100% completo

Lo construido hasta ahora cubre el registro, el cobro automático, y el aislamiento entre
restaurantes. Todavía faltaría (para una siguiente etapa):

- Un **panel de super-administrador** para ti (el dueño del SaaS): ver todos los
  restaurantes registrados, su estado de pago, suspender cuentas manualmente, etc.
- Una página de mercadeo más elaborada en la raíz del dominio (hoy `registro.html` es
  funcional pero sencilla).
- Manejo de "¿qué pasa si alguien cancela la suscripción?" más allá de cambiar el estado a
  "suspendido" (hoy, si se suspende, el restaurante simplemente no puede entrar más —
  todavía no hay una pantalla explicándole por qué, ni un flujo para reactivar pagando de nuevo).

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
