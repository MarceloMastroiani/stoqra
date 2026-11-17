import type { Context } from "grammy";
import type { ConversationFlavor } from "@grammyjs/conversations";

// Contexto "de afuera": el que ve el middleware y conoce ctx.conversation.
export type BotContext = ConversationFlavor<Context>;

// Contexto "de adentro": el que reciben las conversations.
export type ConversationContext = Context;
