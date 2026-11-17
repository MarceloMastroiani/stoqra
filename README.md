<p align="center">
  <img src="./assets/stoqra-horizontal.svg" alt="Stoqra" width="420">
</p>

<p align="center">
  <strong>Tu asistente de IA en Telegram, con tu propia API key.</strong>
</p>

<p align="center">
  <a href="https://bun.com"><img alt="Bun" src="https://img.shields.io/badge/runtime-Bun-black"></a>
  <a href="https://grammy.dev"><img alt="grammY" src="https://img.shields.io/badge/bot-grammY-blue"></a>
  <a href="./LICENSE"><img alt="Licencia MIT" src="https://img.shields.io/badge/licencia-MIT-green"></a>
</p>

---

## ¿Qué es Stoqra?

Stoqra es un bot de Telegram que te conecta con el modelo de IA de tu preferencia. Cada persona configura **su propio proveedor y su propia API key**, y el bot conserva la memoria de cada conversación, incluso después de reiniciar el servidor.

Con este enfoque no hay costos compartidos: lo que consumas se factura en tu cuenta del proveedor, no en la del que hospeda el bot.

## Características

- **Multi-proveedor:** OpenAI, Anthropic, OpenRouter, Google, Groq y DeepSeek.
- **Tu propia API key:** se configura desde el chat con `/setapikey` y se guarda cifrada (AES-256-GCM).
- **Memoria persistente:** el historial de cada conversación se guarda en SQLite y sobrevive a los reinicios.
- **Configuración guiada:** selección del proveedor con botones y cancelación en cualquier momento con `/cancel`.
- **Agente extensible:** construido sobre LangChain y LangGraph, listo para sumar herramientas.

## Cómo se usa

1. Abre una conversación **privada** con el bot y envía `/start`.
2. Envía `/setapikey`, elige tu proveedor y pega tu API key. El bot borra tu mensaje del chat apenas lo recibe.
3. Escribe cualquier mensaje y el bot responderá usando tu modelo.

### Comandos

| Comando | Descripción |
|---------|-------------|
| `/start` | Saluda e indica cómo configurar el bot |
| `/setapikey` | Inicia la configuración de proveedor y API key (o la reemplaza si ya existe) |
| `/cancel` | Cancela la configuración en curso |

### Proveedores y modelos por defecto

| Proveedor | Modelo por defecto |
|-----------|--------------------|
| `openai` | `gpt-5-mini` |
| `anthropic` | `claude-sonnet-5-5` |
| `openrouter` | `deepseek/deepseek-chat` |
| `google` | `gemini-2.5-flash` |
| `groq` | `llama-3.3-70b-versatile` |
| `deepseek` | `deepseek-chat` |

Los modelos por defecto y los parámetros (`temperature: 0`, `maxTokens: 1024`) se definen en [`src/config/index.ts`](./src/config/index.ts).

## Puesta en marcha

### Requisitos

- [Bun](https://bun.com) instalado
- Un bot de Telegram y su token (créalo con [@BotFather](https://t.me/BotFather) usando `/newbot`)

### Instalación

```bash
git clone https://github.com/MarceloMastroiani/stoqra.git
cd stoqra
bun install
```

### Variables de entorno

Crea un archivo `.env` en la raíz del proyecto:

```env
BOT_TOKEN=tu_token_de_botfather
MASTER_KEY=tu_clave_en_base64
```

| Variable | Obligatoria | Descripción |
|----------|:-----------:|-------------|
| `BOT_TOKEN` | Sí | Token del bot, entregado por @BotFather |
| `MASTER_KEY` | Sí | Clave de 32 bytes codificada en base64, usada para cifrar las API keys |

Puedes generar una `MASTER_KEY` válida con:

```bash
openssl rand -base64 32
```

> **Importante:** guarda la `MASTER_KEY` en un lugar seguro. Si la pierdes o la cambias, las API keys ya guardadas no se podrán descifrar y cada persona tendrá que volver a configurarlas con `/setapikey`.

### Ejecución

```bash
# Desarrollo (reinicia al detectar cambios)
bun run dev

# Producción
bun run src/index.ts
```

Al iniciar correctamente verás en consola: `Bot @tu_bot is running...`. La base de datos `stoqra.db` se crea automáticamente en el directorio desde el que ejecutes el bot.

## Seguridad y privacidad

- Las API keys se cifran con **AES-256-GCM** (IV aleatorio y etiqueta de autenticación) antes de guardarse; nunca se almacenan en texto plano.
- El mensaje con la API key se elimina del chat inmediatamente después de recibirlo.
- Las credenciales y el historial viven en `stoqra.db`, que está excluida del repositorio mediante `.gitignore`. Protege ese archivo y tu `.env`.
- Ten en cuenta que, como cualquier mensaje de Telegram, la API key pasa por los servidores de Telegram al enviarla. Usa una key dedicada para el bot y revócala desde tu proveedor si sospechas que se expuso.
- Configura tu API key **solo en chats privados**, nunca en grupos.

## Cómo funciona

```
Telegram ──► grammY ──► Rutas ──► Controlador ──► AgentService ──► Proveedor de IA
                │                                     │
                └── Conversación /setapikey           └── Memoria (checkpointer SQLite)
```

1. **grammY** recibe los mensajes de Telegram mediante long polling.
2. Las **rutas** los dirigen al controlador o a la conversación de `/setapikey`.
3. `AgentService` crea (y cachea) un agente LangChain por persona, con las credenciales descifradas desde la base de datos.
4. El historial se guarda por conversación (`thread_id` = `usuario-chat`) usando un checkpointer propio sobre `bun:sqlite`.

### Estructura del proyecto

```
src/
├── index.ts                # Punto de entrada: crea el bot y arranca el polling
├── bot/
│   ├── context.ts          # Tipos del contexto de grammY
│   └── conversations/      # Flujos multi-paso (/setapikey)
├── config/
│   ├── envs.ts             # Validación de variables de entorno (Zod)
│   └── index.ts            # Proveedores, modelos y parámetros por defecto
├── controllers/            # Respuesta a cada evento del bot
├── routes/                 # Registro de comandos/eventos y composición de dependencias
├── services/               # Agente de IA, cifrado y lógica de usuarios
├── repository/             # Acceso a datos de usuarios
└── db/                     # SQLite y checkpointer de LangGraph
```

## Roadmap

- [ ] Elegir un modelo específico durante `/setapikey` (hoy se usa el modelo por defecto del proveedor)
- [ ] Comando para reiniciar la memoria de una conversación
- [ ] Recepción y procesamiento de documentos y planillas
- [ ] Herramientas (tools) para el agente
- [ ] Tests y CI

## Documentación adicional

- [Notas de la migración de Telegraf a grammY](./MIGRACION-GRAMMY.md)

## Licencia

Distribuido bajo la licencia [MIT](./LICENSE).
