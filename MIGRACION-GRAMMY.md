# Migración de Telegraf a grammY

Notas de implementación escritas en primera persona, para repasar qué hice y por qué.

---

## 1. Por qué migré

Tenía el bot armado con Telegraf 4.16.3, pero:

- Telegraf está prácticamente sin mantenimiento (la última release es de 2023 y la v5 nunca salió estable).
- Arrastra dependencias que no necesito (`node-fetch`, `abort-controller`, `debug`, `sandwich-stream`, `p-timeout`).
- Su tipado es ancho: `ctx.message.text` es `string | undefined` siempre, así que termino escribiendo guards a mano en cada handler.
- No tenía una forma limpia de modelar flujos multi-paso. En mi caso, `/setapikey` era una máquina de estados manual con un `Map<string, ApiKeySession>`.

grammY resuelve las cuatro cosas: está activo, tiene **cero dependencias**, infiere tipos según el filtro del handler, y trae un plugin oficial de conversaciones que es exactamente lo que estaba emulando a mano.

Además encontré un bug mientras migraba: el teclado inline de proveedores se mostraba, pero **los botones no hacían nada** porque nunca registré un handler de `callback_query`. Aproveché para arreglarlo.

---

## 2. Cómo funciona grammY (lo mínimo que necesito recordar)

1. Telegram manda **updates** (mensajes, callbacks, etc.).
2. `bot.start()` arranca el *long polling*: pide updates y los pasa por una **cadena de middleware**.
3. Cada handler recibe un `ctx` (contexto) con el update, helpers (`ctx.reply`, `ctx.answerCallbackQuery`) y la API (`ctx.api`).
4. Los handlers se ejecutan **en orden de registro**; el que responde no corta la cadena salvo que no llame a `next()` (los míos no lo llaman, así que cortan).
5. Los *filtros* son strings con azúcar: `bot.on("message:text")` no solo filtra, también **estrecha el tipo** del contexto.

La diferencia más importante con Telegraf: en grammY los filtros son tipos, no solo runtime. Eso es lo que me permite borrar los guards manuales del controller.

---

## 3. Dependencias

```bash
bun remove telegraf
bun add grammy @grammyjs/conversations
```

Quedó:

```json
"dependencies": {
  "@grammyjs/conversations": "^2.1.1",
  "grammy": "^1.46.0",
  ...
}
```

`@grammyjs/conversations` es un plugin separado porque no todo bot lo necesita; declara `grammy ^1.20.1` como peer.

---

## 4. Punto de entrada: `src/index.ts`

```ts
import { Bot } from "grammy";

import { envs } from "./config/envs";
import { setUpRoutes } from "./routes/bot.routes";
import type { BotContext } from "./bot/context";

const bot = new Bot<BotContext>(envs.botToken);

setUpRoutes(bot);

bot.catch((err) => {
  console.error(err.error);
  void err.ctx.reply("Oops, something went wrong.");
});

void bot.start({
  onStart: (me) => console.log(`Bot @${me.username} is running...`),
});

process.once("SIGINT", () => bot.stop());
process.once("SIGTERM", () => bot.stop());
```

Cosas que aprendí acá:

- **`new Bot<BotContext>`**: el genérico es el tipo de contexto de *afuera*. Lo necesito porque el plugin de conversaciones agrega `ctx.conversation`.
- **`bot.start()` en grammY arranca el polling**, no registra el comando `/start`. En Telegraf `bot.start(cb)` era el handler del comando. Esa colisión de nombres es la trampa número uno de la migración: el handler del comando ahora es `bot.command("start", ...)` y está en las rutas.
- **`onStart`** me da la info del bot (`me.username`), así que el log confirma que el polling arrancó de verdad.
- **`bot.catch`** recibe un `BotError`: `err.error` es la excepción real y `err.ctx` el contexto donde ocurrió. Por eso puedo responderle al usuario desde ahí, cosa que en Telegraf hacía con `(err, ctx)`.
- **`bot.stop()` sin argumentos**: en Telegraf era `bot.stop("SIGINT")`. grammY no necesita el motivo.
- Saqué el `if (!telegramBotToken) throw ...` porque `envs` ya valida con Zod y, si el token fuera inválido, el constructor de `Bot` tira su propio error.
- Saqué el `try/catch` de `main()`: los errores de arranque y de los handlers caen en `bot.catch`.

---

## 5. `src/bot/context.ts`

```ts
import type { Context } from "grammy";
import type { ConversationFlavor } from "@grammyjs/conversations";

// Contexto "de afuera": el que ve el middleware y conoce ctx.conversation.
export type BotContext = ConversationFlavor<Context>;

// Contexto "de adentro": el que reciben las conversations.
export type ConversationContext = Context;
```

El plugin de conversaciones maneja **dos tipos de contexto**:

- **De afuera**: el del middleware normal. Tiene `ctx.conversation.enter(...)`.
- **De adentro**: el que se genera a partir de cada update dentro de la conversación. No tiene `ctx.conversation` (no podés entrar a otra conversación desde adentro por el contexto; se llama como función).

Tener los dos tipos en un archivo aparte evita repetir los genéricos en todos lados.

---

## 6. `src/routes/bot.routes.ts`

```ts
export const setUpRoutes = (bot: Bot<BotContext>) => {
  const userService = new UserService(userRepository);
  const agentService = new AgentService(userService, cryptoService);
  const botController = new BotController(userService, cryptoService, agentService);

  // Las conversations se instalan antes de los handlers que las invocan.
  bot.use(conversations());
  bot.use(
    createConversation(
      createSetApiKeyConversation({ userService, cryptoService, agentService }),
      SET_API_KEY_CONVERSATION
    )
  );

  bot.command("start", (ctx) => botController.start(ctx));
  bot.command("setapikey", (ctx) => ctx.conversation.enter(SET_API_KEY_CONVERSATION));
  bot.command("cancel", (ctx) => ctx.reply("No hay ninguna configuración en curso."));
  bot.on("message:text", (ctx) => botController.message(ctx));
  bot.on("message:document", (ctx) => botController.handleDocument(ctx));
};
```

Decisiones:

- **Mantuve la raíz de composición acá** (servicios, repositorio, controller) en vez de meter un contenedor de DI. Es el mismo estilo que ya tenía el proyecto.
- **El orden importa**: `conversations()` se instala antes de `createConversation`, y ambos antes del comando que los invoca. En grammY no podés entrar a una conversación que no fue instalada previamente.
- **`ctx.conversation.enter("setApiKey")`** inicia el flujo. Uso una constante (`SET_API_KEY_CONVERSATION`) y no un string suelto para que el nombre no se desincronice entre el registro y la invocación.
- **Los comandos van antes del handler de texto.** Un mensaje `/start` también matchea `message:text` (los comandos son mensajes de texto con entidades). Si registrara primero el texto, el comando nunca llegaría a su handler.
- **`bot.command("cancel")` global** solo responde cuando *no* hay conversación activa. Mientras hay una, el plugin intercepta el update y lo consume la conversación (lo manejo adentro con `waitForCommand("cancel")`).
- **`message("text")` de Telegraf → `"message:text"`**: mismo comportamiento, pero ahora es un filtro tipado y no necesito importar `telegraf/filters`.
- Eliminé la clase `BotRouter`: con cuatro líneas de registro no aportaba nada.

---

## 7. El flujo de `/setapikey`: `src/bot/conversations/set-api-key.conversation.ts`

### 7.1 La idea

Antes tenía esto:

```ts
type ApiKeySession =
  | { step: "waiting-provider" }
  | { step: "waiting-model"; provider: Provider }
  | { step: "waiting-api-key"; provider: Provider; model: string };

private readonly apiKeySessions = new Map<string, ApiKeySession>();
```

Y en cada mensaje revisaba en qué paso estaba el usuario para decidir qué hacer. Funcionaba, pero:

- La lógica del flujo estaba mezclada con el manejo de mensajes normales.
- Había que limpiar el Map a mano (y si el bot reiniciaba, quedaba basura).
- Los botones de proveedor no tenían handler.

Con conversaciones, el flujo se lee **de arriba hacia abajo** como código normal:

```ts
export function createSetApiKeyConversation(deps: SetApiKeyDeps) {
  return async function setApiKey(conversation, ctx) {
    // 1. aviso si ya había key
    // 2. teclado de proveedores
    // 3. esperar callback del proveedor
    // 4. esperar modelo
    // 5. esperar API key
    // 6. guardar + confirmar
  };
}
```

Uso una **fábrica** (`createSetApiKeyConversation(deps)`) para inyectar los servicios sin depender de un contexto custom: la conversación es una función y puede capturar las dependencias por closure.

### 7.2 La regla de oro: replay

Esto es lo más importante que tuve que entender:

> Una conversation **no se ejecuta linealmente**. Se ejecuta hasta el primer `wait`, se suspende, y en el próximo update **se vuelve a ejecutar desde el principio** hasta llegar otra vez al `wait`.

En la práctica, cada línea se ejecuta muchas veces. grammY se encarga de **no repetir** las llamadas a la API de Telegram (`ctx.reply`, `ctx.editMessageText`, etc.). Pero **mis** efectos secundarios (base de datos, cifrado, red) se repetirían. Para eso existe:

```ts
await conversation.external(() => deps.userService.getUser(userId));
```

`conversation.external` ejecuta el código **una sola vez** y guarda el resultado para reusarlo en los replays. Todo lo que sea IO va ahí:

```ts
const existing = await conversation.external(() => deps.userService.getUser(userId));

const apiKeyEncrypted = await conversation.external(() =>
  deps.cryptoService.encrypt(apiKey)
);
await conversation.external(() =>
  deps.userService.createUser(userId, provider, model, apiKeyEncrypted)
);
await conversation.external(() => {
  deps.agentService.invalidateUser(userId);
});
```

En cambio `ctx.reply` / `editMessageText` / `answerCallbackQuery` van **directo**, sin `external`: el plugin los reconoce y los deduplica.

Detalle: lo que devuelve `external` tiene que ser serializable (se guarda como JSON). Por eso `createUser` devuelve `void` y `encrypt` un `string`.

### 7.3 Cancelación

```ts
void conversation.waitForCommand("cancel").then(async (cancelCtx) => {
  await cancelCtx.reply("Configuración cancelada.");
  await conversation.halt();
});
```

Es el patrón oficial para un "escape global" dentro de una conversación:

- La promesa queda **flotante** (no la espero) para que el plugin la registre como un `wait` más.
- `halt()` termina la conversación y descarta el estado.
- Si el usuario escribe `/cancel` en cualquier paso, gana este `wait` porque se registró antes que los demás.
- Si alguien "cancela" sin conversación activa, lo atiende el `bot.command("cancel")` de las rutas.

### 7.4 El teclado inline (y el bug que arreglé)

```ts
const keyboard = new InlineKeyboard();
PROVIDERS.forEach((provider, index) => {
  keyboard.text(provider, `${PROVIDER_CALLBACK_PREFIX}${provider}`);
  if (index % 2 === 1) keyboard.row();
});

await ctx.reply("Selecciona tu proveedor de IA", { reply_markup: keyboard });
```

Diferencias con Telegraf:

| Telegraf | grammY |
|---|---|
| `Markup.button.callback(label, data)` | `keyboard.text(label, data)` |
| `Markup.inlineKeyboard([[btn]])` | `new InlineKeyboard()` + `.row()` |
| `ctx.reply(texto, markup)` | `ctx.reply(texto, { reply_markup: markup })` |

El **callback data** lleva prefijo (`provider:openai`) para que no colisione con futuros botones. Después lo leo con:

```ts
const providerCtx = await conversation.waitForCallbackQuery(/^provider:.+$/);
await providerCtx.answerCallbackQuery(); // apaga el spinner del botón

const provider = providerCtx.callbackQuery.data.slice(PROVIDER_CALLBACK_PREFIX.length);
```

- `answerCallbackQuery()` es **obligatorio**: si no, Telegram deja el botón "cargando" hasta que expira.
- Uso `.slice()` en vez de `ctx.match` porque el tipo de `match` es `string | RegExpMatchArray | undefined` y con `strict` + `noUncheckedIndexedAccess` tendría que hacer guards extra sin ganar nada.
- `isProvider` es un *type guard* (`value is Provider`) que valida contra `PROVIDERS`; sin él, `slice` devuelve `string` y no puedo pasarlo a `createUser`.

Y el mensaje de selección se **edita** en vez de mandar otro:

```ts
await providerCtx.editMessageText(
  `Proveedor: ${provider}\n\n¿Qué modelo usás? (ej: ${modelExample})`
);
```

Así el chat no se llena de mensajes y el botón queda "consumido".

### 7.5 Modelo y API key

```ts
let modelCtx = await conversation.waitFor("message:text");
while (!modelCtx.message.text.trim()) {
  await modelCtx.reply("El modelo no puede estar vacío. Escribí el nombre del modelo.");
  modelCtx = await conversation.waitFor("message:text");
}
const model = modelCtx.message.text.trim();
```

Acá se ve la otra ventaja del tipado: dentro de `waitFor("message:text")`, `ctx.message.text` es `string`, no `string | undefined`. El `while` es solo por si mandan espacios.

Para la key hago lo mismo, pero además:

```ts
await keyCtx.deleteMessage().catch(() => {});
```

Borro el mensaje con la clave del chat. El `.catch(() => {})` es porque `deleteMessage` puede fallar (mensajes viejos, permisos) y no quiero que eso rompa el flujo.

### 7.6 Al final

```ts
await keyCtx.reply(
  `✅ Configuración guardada.\n\nProveedor: ${provider}\nModelo: ${model}\nAPI Key: configurada`
);
```

Al salir de la función la conversación termina sola y el plugin limpia el estado. Ya no hay nada que "borrar del Map".

### 7.7 El flujo, resumido

```
Usuario                Bot                          Servicios
  |  /setapikey          |                              |
  |--------------------->| enter("setApiKey")           |
  |                      | getUser() ──external────────>|
  |  "Selecciona..."     |<─────────────────────────────|
  |<---------------------|                              |
  |  [openrouter]        |                              |
  |--------------------->| answerCallbackQuery()        |
  |  "Proveedor: ..."    | editMessageText()            |
  |<---------------------|                              |
  |  "deepseek/..."      | (espera texto)               |
  |--------------------->|                              |
  |  "sk-..."            | deleteMessage()              |
  |--------------------->| encrypt() ──external────────>|
  |                      | createUser() ──external─────>|
  |                      | invalidateUser() ──external─>|
  |  "✅ Guardada"       |<─────────────────────────────|
  |<---------------------|                              |
```

---

## 8. `src/controllers/bot.controller.ts`

```ts
type TextContext = Filter<Context, "message:text">;
type DocumentContext = Filter<Context, "message:document">;

export class BotController {
  constructor(
    private readonly userService: UserService,
    private readonly cryptoService: CryptoService,
    private readonly agentService: AgentService
  ) {}

  async handleDocument(ctx: DocumentContext) {
    try {
      return ctx.reply(ctx.message.document.file_name ?? "No file name");
    } catch (error) {
      console.log(error);
    }
  }

  async message(ctx: TextContext) {
    try {
      const message = ctx.message.text;
      if (!message.trim()) return;

      const userId = ctx.from?.id.toString() ?? "";
      const chatId = ctx.chat?.id.toString() ?? "";
      const sessionId = `${userId}-${chatId}`;

      const response = await this.agentService.getResponse(message, sessionId, userId);
      await ctx.reply(response);
    } catch {
      await ctx.reply("Something went wrong");
    }
  }

  async start(ctx: Context) {
    await ctx.reply("Hola, soy Stoqra. Usá /setapikey para configurar tu proveedor de IA.");
  }
}
```

Qué saqué y por qué:

- **Todo el flujo de API key**: ahora vive en la conversación. El controller volvió a ser lo que debería ser: recibir un mensaje y delegar.
- **Los guards manuales**:
  ```ts
  // antes
  if (!ctx.message || !("text" in ctx.message)) return;
  // ahora el tipo ya lo garantiza
  ```
  `Filter<Context, "message:text">` me da `ctx.message.text: string`. El handler de la ruta está registrado con ese mismo filtro, así que los tipos encajan.
- **`sessionId = ${userId}-${chatId}`** sigue igual: eso es para el `thread_id` del agente de LangChain (memoria de conversación), no tiene que ver con el estado de grammY.
- Los servicios en el constructor quedaron igual; `userService` y `cryptoService` hoy no se usan en el controller pero los dejo porque la fábrica de la conversación los recibe en las rutas. Se podrían sacar del controller si querés limpiar más.

---

## 9. Lo que probé

1. **Typecheck**: `bunx tsc --noEmit` limpio. Importante porque el proyecto tiene `strict`, `noUncheckedIndexedAccess` y `verbatimModuleSyntax`.
2. **Construcción del bot sin red**: importar rutas y armar el `Bot` con un token falso verifica que todo el middleware se registra sin errores.
3. **Smoke test offline del flujo** con `bot.handleUpdate()` (no hace red si le ponés un transformer a la API), servicios mockeados y `botInfo` falso:
   - `/setapikey` → callback `provider:openrouter` → modelo → key → `createUser(7,openrouter,deepseek/deepseek-chat,enc:sk-test-123)`, `invalidateUser(7)` y confirmación. Los efectos secundarios corrieron **una sola vez**.
   - `/cancel` a mitad del flujo → "Configuración cancelada." y **sin** `createUser`.

Dos cosas que descubrí en el test:

- `bot.handleUpdate` exige `await bot.init()` o pasar `botInfo` en el constructor, si no tira `Bot not initialized!`.
- Los **transformers** instalados con `bot.api.config.use(...)` **no se heredan** dentro de las conversaciones. Si algún día agrego `auto-retry` o `transformer-throttler`, hay que pasarlos también como plugin: `conversations({ plugins: [...] })`.

---

## 10. Checklist manual con el bot real (`bun run dev`)

- [ ] `/start` responde el saludo.
- [ ] `/setapikey` muestra 6 botones en 2 columnas.
- [ ] Al tocar un proveedor, el botón deja de girar y el mensaje se edita.
- [ ] Flujo completo termina en "✅ Configuración guardada".
- [ ] El mensaje con la API key desaparece del chat.
- [ ] `/cancel` en cada paso corta el flujo y avisa.
- [ ] `/setapikey` con una key ya guardada avisa que la va a reemplazar.
- [ ] Un mensaje de texto normal sigue llegando al agente.
- [ ] Subir un documento responde con el nombre del archivo.
- [ ] `/cancel` sin conversación activa responde "No hay ninguna configuración en curso."

---

## 11. Limitaciones y próximos pasos

- **El estado de las conversaciones es en memoria** (igual que el `Map` anterior). Si el proceso reinicia a mitad de un flujo, se pierde. Se puede persistir con un adapter de `@grammyjs/storages`, o aceptar el comportamiento actual.
- **Comandos durante el flujo**: mientras hay conversación activa, cualquier update de ese chat lo consume la conversación. Si el usuario escribe `/start` en el medio, se toma como respuesta del paso actual. Se puede mitigar con `otherwise` en los `waitFor` o validando el prefijo `/`.
- **Persistencia del contexto del agente**: sigue siendo LangChain quien guarda la memoria por `thread_id` en SQLite, sin cambios.
- **Ideas**: `bot.api.setMyCommands([...])` para el menú de comandos, `@grammyjs/auto-retry` si aparecen 429, y `webhookCallback` + `Bun.serve` si algún día se deja el polling.
- **`node_modules` ya estaba trackeado en git** aunque está en `.gitignore`, por eso la baja de telegraf aparece como cientos de archivos eliminados en `git status`. Es previo a este cambio; si molesta: `git rm -r --cached node_modules`.
