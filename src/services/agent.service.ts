import { createAgent } from "langchain";
import {ChatOpenRouter} from "@langchain/openrouter"
import { modelConfig } from "../config";
import { MemorySaver } from "@langchain/langgraph";


class AgentService {
  //Un modelo simplemente recibe información y genera una respuesta
  private model: ChatOpenRouter;

  //El agente utiliza el modelo que creaste y puede tener herramientas y memoria
  private agent: ReturnType<typeof createAgent> // agent va a tener exactamente el tipo que devuelve createAgent

  constructor() {
    this.model = new ChatOpenRouter(modelConfig);

    this.agent = createAgent({
      model: this.model,
      tools: [],
      checkpointer: new MemorySaver(), // Permite guardar el estado de las ejecuciones del agente asociado a un thread_id.
      systemPrompt: "You are a helpful assistant.",
    });
  }


  async getResponse(message: string, sessionId: string): Promise<string> {
    try {

      const config = {
        // Esta ejecución pertenece al thread identificado por sessionId.
        configurable: {
          thread_id: sessionId
        },
      }

      const result = await this.agent.invoke(
        {
          messages: [
            {
              role: "user",
              content: message,
            },
          ],
        },
        config
      );

      const lastMessage = result.messages[result.messages.length - 1];

      if (lastMessage && "content" in lastMessage) {
        return lastMessage.content as string;
      }

      return "No response from agent";

    } catch (error) {
      console.error("Error in agent service:", error);
      return "Error processing your request.";
    }

  }

}

export default new AgentService();
