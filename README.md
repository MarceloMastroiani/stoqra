# bot-telegram

Un bot de Telegram construido con [Telegraf](https://telegraf.js.org/) y [Bun](https://bun.com).

## Descripción

Este proyecto es un bot de Telegram básico que:
- Responde al comando `/start` con un saludo personalizado
- Responde a cualquier mensaje de texto repitiendo lo que el usuario escribió
- Muestra el username del usuario que envió el mensaje
- Tiene manejo de errores tanto a nivel individual como global

## Estructura del Proyecto

```
src/
├── config/         # Configuración y validación de entorno
├── controllers/    # Lógica de negocio del bot
├── routes/         # Mapeo de comandos y eventos a controladores
├── index.ts        # Punto de entrada principal
```

## Archivos Principales

### `src/index.ts` - Punto de Entrada

El archivo principal que inicializa el bot. Realiza las siguientes tareas:

1. **Carga y valida la configuración** - Obtiene el token de las variables de entorno
2. **Crea la instancia del bot** - Instancia de Telegraf con el token verificado
3. **Registra las rutas** - Configura todos los comandos y manejadores de eventos
4. **Arranca el bot** - Inicia la escucha de actualizaciones de Telegram
5. **Maneja señales de terminación** - Soporta Ctrl+C y SIGTERM para apagado ordenado
6. **Manejo global de errores** - Captura errores no manejados en cualquier handler

### `src/config/envs.ts` - Configuración de Entorno

Carga y valida las variables de entorno usando [Zod](https://zod.dev/):

- **Requisitos obligatorios**: `BOT_TOKEN` - Token del bot obtenido de @BotFather
- **Validación**: Usa schema de Zod para asegurar que el token esté presente y sea un string
- **Configuración de dotenv**: Carga automáticamente el archivo `.env` en `process.env`

Si `BOT_TOKEN` no está definido, la aplicación fallará al iniciar con el mensaje: `BOT_TOKEN is not defined`

### `src/controllers/bot.controller.ts` - Controladores de Lógica

Agrupa todos los manejadores de eventos del bot:

#### `message(ctx)` - Manejador de mensajes de texto

Se dispara para cualquier mensaje de texto entrante:

1. Valida que el mensaje exista y tenga contenido de texto
2. Obtiene el texto del mensaje (o vacío si es null/undefined)
3. Verifica que el texto no esté vacío solo con espacios
4. Responde al usuario repitiendo: `You said: {message}`
5. Si el usuario tiene username, envía: `Your username: {username}`
6. Bloque try/catch para manejar errores inesperados - si falla, responde: `Something went wrong`

#### `start(ctx)` - Manejador del comando `/start`

Se ejecuta cuando el usuario escribe `/start`:

1. Envía un saludo personalizado: `Hello from {username}`
2. Si no hay username disponible, usa "you" como fallback
3. Usa encadenamiento opcional `?.` para evitar errores si `ctx.from` es undefined

### `src/routes/bot.routes.ts` - Registro de Rutas

Conecta los eventos de Telegram con los controladores:

- **`bot.start()`**: Registra el comando `/start` → llama a `botController.start()`
- **`bot.on(message("text"))`**: Registra cualquier mensaje de texto → llama a `botController.message()`
- Filtra específicamente mensajes de texto simple (no comandos, no fotos, no callbacks)

## Variables de Entorno

Crear un archivo `.env` en la raíz del proyecto con:

```
BOT_TOKEN=tu_token_de_telegram_aquí
```

El token se obtiene hablando con [@BotFather](https://t.me/BotFather) en Telegram y usando el comando `/newbot`.

## Scripts Disponibles

| Script | Descripción |
|--------|-------------|
| `bun install` | Instala las dependencias del proyecto |
| `bun run index.ts` | Inicia el bot de desarrollo |
| `bun dev` | Alias para `bun run index.ts` (desde package.json) |

## Tecnologías Utilizadas

- **Telegraf**: Framework para bot de Telegram
- **Zod**: Validación de schemas de entorno
- **dotenv**: Carga de variables de entorno desde archivo `.env`
- **TypeScript**: Tipado estático
- **Bun**: Runtime de JavaScript

## Patrón de Arquitectura

El código sigue una separación clara de responsabilidades:

1. **Configuración** (`config/envs.ts`): Solo validación de entorno, sin lógica de negocio
2. **Controladores** (`controllers/bot.controller.ts`): Lógica pura de qué hacer ante cada evento
3. **Rutas** (`routes/bot.routes.ts`): Mapeo de eventos de Telegram a controladores
4. **Entrada** (`index.ts`): Orquestación y arranque

Este patrón facilita mantener y escalar el bot en el futuro, permitiendo agregar nuevos comandos y funcionalidades de forma organizada.

## Manejo de Errores

Dos capas de protección:

1. **Intra-handler** (en el controlador): Cada método tiene try/catch individual. Errores -> respuesta "Something went wrong" al usuario.
2. **Inter-handler** (global en `index.ts`): `bot.catch()` captura errores que escaparon de los try/catch individuales.

## Expansión Futura

Para agregar nuevas funcionalidades:

1. **Nuevo comando**: En `src/routes/bot.routes.ts`, agregar `bot.command("nombre", (ctx) => botController.metodo(ctx))`
2. **Nueva lógica**: En `src/controllers/bot.controller.ts`, agregar un nuevo método async en la clase `BotController`
3. **Nuevas variables**: Agregar al schema en `src/config/envs.ts` y usar en los controladores

## Licencian

Este proyecto está bajo la licencia MIT.
