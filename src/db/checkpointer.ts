import { Database } from "bun:sqlite";
import { BaseCheckpointSaver } from "@langchain/langgraph-checkpoint";
import type {
  Checkpoint,
  CheckpointMetadata,
  CheckpointTuple,
  PendingWrite,
} from "@langchain/langgraph-checkpoint";
import type { RunnableConfig } from "@langchain/core/runnables";

export class BunSqliteSaver extends BaseCheckpointSaver {
  private db: Database;

  constructor(db: Database) {
    super();
    this.db = db;
    this.setup();
  }

  private setup(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS checkpoints (
        thread_id TEXT NOT NULL,
        checkpoint_ns TEXT NOT NULL DEFAULT '',
        checkpoint_id TEXT NOT NULL,
        parent_checkpoint_id TEXT,
        type TEXT,
        checkpoint BLOB NOT NULL,
        metadata BLOB NOT NULL,
        PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id)
      )
    `);
    this.db.run(`
      CREATE TABLE IF NOT EXISTS writes (
        thread_id TEXT NOT NULL,
        checkpoint_ns TEXT NOT NULL DEFAULT '',
        checkpoint_id TEXT NOT NULL,
        task_id TEXT NOT NULL,
        idx INTEGER NOT NULL,
        channel TEXT NOT NULL,
        type TEXT,
        value BLOB,
        PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id, task_id, idx)
      )
    `);
  }

  // Leer el estado actual de una conversación
  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    const threadId = config.configurable?.thread_id;
    const checkpointNs = config.configurable?.checkpoint_ns ?? "";
    const checkpointId = config.configurable?.checkpoint_id;

    const row = checkpointId
      ? this.db
          .query(
            `SELECT * FROM checkpoints WHERE thread_id = ? AND checkpoint_ns = ? AND checkpoint_id = ?`
          )
          .get(threadId, checkpointNs, checkpointId) as any
      : this.db
          .query(
            `SELECT * FROM checkpoints WHERE thread_id = ? AND checkpoint_ns = ?
             ORDER BY checkpoint_id DESC LIMIT 1`
          )
          .get(threadId, checkpointNs) as any;

    if (!row) return undefined;

    const checkpoint = (await this.serde.loadsTyped(
      row.type,
      row.checkpoint
    )) as Checkpoint;
    const metadata = (await this.serde.loadsTyped(
      row.type,
      row.metadata
    )) as CheckpointMetadata;

    //
    const writeRows = this.db
      .query(
        `SELECT * FROM writes WHERE thread_id = ? AND checkpoint_ns = ? AND checkpoint_id = ?
         ORDER BY task_id, idx`
      )
      .all(threadId, checkpointNs, row.checkpoint_id) as any[];

    const pendingWrites: [string, string, unknown][] = [];
    for (const w of writeRows) {
      const value = await this.serde.loadsTyped(w.type, w.value);
      pendingWrites.push([w.task_id, w.channel, value]);
    }

    return {
      config: {
        configurable: {
          thread_id: threadId,
          checkpoint_ns: checkpointNs,
          checkpoint_id: row.checkpoint_id,
        },
      },
      checkpoint,
      metadata,
      parentConfig: row.parent_checkpoint_id
        ? {
            configurable: {
              thread_id: threadId,
              checkpoint_ns: checkpointNs,
              checkpoint_id: row.parent_checkpoint_id,
            },
          }
        : undefined,
      pendingWrites,
    };
  }

  // Recorrer el historial
  async *list(
    config: RunnableConfig,
    options?: { limit?: number; before?: RunnableConfig }
  ): AsyncGenerator<CheckpointTuple> {
    const threadId = config.configurable?.thread_id;
    const checkpointNs = config.configurable?.checkpoint_ns ?? "";

    let sql = `SELECT checkpoint_id FROM checkpoints WHERE thread_id = ? AND checkpoint_ns = ?`;
    const params: any[] = [threadId, checkpointNs];

    if (options?.before?.configurable?.checkpoint_id) {
      sql += ` AND checkpoint_id < ?`;
      params.push(options.before.configurable.checkpoint_id);
    }
    sql += ` ORDER BY checkpoint_id DESC`;
    if (options?.limit) sql += ` LIMIT ${Number(options.limit)}`;

    const rows = this.db.query(sql).all(...params) as any[];

    for (const row of rows) {
      const tuple = await this.getTuple({
        configurable: {
          thread_id: threadId,
          checkpoint_ns: checkpointNs,
          checkpoint_id: row.checkpoint_id,
        },
      });
      if (tuple) yield tuple;
    }
  }

  // Guardar un nuevo checkpoint
  async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata
  ): Promise<RunnableConfig> {
    const threadId = config.configurable?.thread_id;
    const checkpointNs = config.configurable?.checkpoint_ns ?? "";
    const parentCheckpointId = config.configurable?.checkpoint_id;

    const [type, serializedCheckpoint] = await this.serde.dumpsTyped(checkpoint);
    const [, serializedMetadata] = await this.serde.dumpsTyped(metadata);

    this.db.run(
      `INSERT INTO checkpoints
        (thread_id, checkpoint_ns, checkpoint_id, parent_checkpoint_id, type, checkpoint, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(thread_id, checkpoint_ns, checkpoint_id) DO UPDATE SET
         checkpoint = excluded.checkpoint,
         metadata = excluded.metadata`,
      [
        threadId,
        checkpointNs,
        checkpoint.id,
        parentCheckpointId ?? null,
        type,
        serializedCheckpoint,
        serializedMetadata,
      ]
    );

    return {
      configurable: {
        thread_id: threadId,
        checkpoint_ns: checkpointNs,
        checkpoint_id: checkpoint.id,
      },
    };
  }

  // Guardar los cambios en borrador
  async putWrites(
    config: RunnableConfig,
    writes: PendingWrite[],
    taskId: string
  ): Promise<void> {
    const threadId = config.configurable?.thread_id;
    const checkpointNs = config.configurable?.checkpoint_ns ?? "";
    const checkpointId = config.configurable?.checkpoint_id;

    for (const [idx, [channel, value]] of writes.entries()) {
      const [type, serializedValue] = await this.serde.dumpsTyped(value);
      this.db.run(
        `INSERT INTO writes
          (thread_id, checkpoint_ns, checkpoint_id, task_id, idx, channel, type, value)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(thread_id, checkpoint_ns, checkpoint_id, task_id, idx) DO UPDATE SET
           channel = excluded.channel, type = excluded.type, value = excluded.value`,
        [threadId, checkpointNs, checkpointId, taskId, idx, channel, type, serializedValue]
      );
    }
  }

  // Borrar una conversación entera
  async deleteThread(threadId: string): Promise<void> {
    this.db.run(`DELETE FROM checkpoints WHERE thread_id = ?`, [threadId]);
    this.db.run(`DELETE FROM writes WHERE thread_id = ?`, [threadId]);
  }
}
