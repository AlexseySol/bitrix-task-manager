export type BitrixProfile = {
  ID: string | number;
  NAME?: string;
  LAST_NAME?: string;
  EMAIL?: string;
};

export type BitrixTask = {
  id?: string | number;
  ID?: string | number;
  title?: string;
  TITLE?: string;
  description?: string;
  DESCRIPTION?: string;
  responsibleId?: string | number;
  RESPONSIBLE_ID?: string | number;
  createdBy?: string | number;
  CREATED_BY?: string | number;
  status?: string | number;
  STATUS?: string | number;
  deadline?: string | null;
  DEADLINE?: string | null;
  priority?: string | number;
  PRIORITY?: string | number;
};

type BitrixResponse<T> = {
  result?: T;
  error?: string;
  error_description?: string;
};

export class BitrixClient {
  private readonly webhookUrl: string;
  private profileCache?: BitrixProfile;

  constructor(webhookUrl: string) {
    this.webhookUrl = this.normalizeWebhookUrl(webhookUrl);
  }

  async profile(): Promise<BitrixProfile> {
    if (!this.profileCache) {
      this.profileCache = await this.call<BitrixProfile>("profile", {});
    }

    return this.profileCache;
  }

  async currentUserId(): Promise<string> {
    const profile = await this.profile();
    return String(profile.ID);
  }

  async listMyTasks(input: { status?: string; limit?: number } = {}): Promise<BitrixTask[]> {
    const currentUserId = await this.currentUserId();
    const filter: Record<string, string | number> = {
      RESPONSIBLE_ID: currentUserId
    };

    if (input.status === "open") {
      filter["!STATUS"] = 5;
    } else if (input.status === "completed") {
      filter.STATUS = 5;
    }

    const result = await this.call<{ tasks?: BitrixTask[] } | BitrixTask[]>("tasks.task.list", {
      filter,
      select: [
        "ID",
        "TITLE",
        "DESCRIPTION",
        "STATUS",
        "DEADLINE",
        "RESPONSIBLE_ID",
        "CREATED_BY",
        "PRIORITY",
        "CREATED_DATE",
        "CHANGED_DATE"
      ],
      order: {
        DEADLINE: "asc",
        ID: "desc"
      }
    });

    const tasks = Array.isArray(result) ? result : result.tasks ?? [];
    return tasks.slice(0, input.limit ?? 50);
  }

  async getMyTask(taskId: number): Promise<BitrixTask> {
    const task = await this.getTask(taskId);
    await this.assertTaskBelongsToCurrentUser(task);
    return task;
  }

  async createMyTask(input: {
    title: string;
    description?: string;
    deadline?: string;
    priority?: "1" | "2";
  }): Promise<BitrixTask> {
    const currentUserId = await this.currentUserId();
    const fields: Record<string, string | number> = {
      TITLE: input.title,
      RESPONSIBLE_ID: currentUserId
    };

    if (input.description) {
      fields.DESCRIPTION = input.description;
    }
    if (input.deadline) {
      fields.DEADLINE = input.deadline;
    }
    if (input.priority) {
      fields.PRIORITY = input.priority;
    }

    const result = await this.call<{ task: BitrixTask }>("tasks.task.add", { fields });
    return result.task;
  }

  async updateMyTask(
    taskId: number,
    input: {
      title?: string;
      description?: string;
      deadline?: string | null;
      priority?: "1" | "2";
    }
  ): Promise<BitrixTask> {
    await this.getMyTask(taskId);

    const fields: Record<string, string | number | null> = {};
    if (input.title !== undefined) {
      fields.TITLE = input.title;
    }
    if (input.description !== undefined) {
      fields.DESCRIPTION = input.description;
    }
    if (input.deadline !== undefined) {
      fields.DEADLINE = input.deadline;
    }
    if (input.priority !== undefined) {
      fields.PRIORITY = input.priority;
    }

    if (Object.keys(fields).length === 0) {
      throw new Error("At least one update field is required.");
    }

    const result = await this.call<{ task: BitrixTask }>("tasks.task.update", {
      taskId,
      fields
    });
    await this.assertTaskBelongsToCurrentUser(result.task);
    return result.task;
  }

  async startMyTask(taskId: number): Promise<BitrixTask> {
    await this.getMyTask(taskId);
    const result = await this.call<{ task: BitrixTask }>("tasks.task.start", { taskId });
    await this.assertTaskBelongsToCurrentUser(result.task);
    return result.task;
  }

  async completeMyTask(taskId: number): Promise<BitrixTask> {
    await this.getMyTask(taskId);
    const result = await this.call<{ task: BitrixTask }>("tasks.task.complete", { taskId });
    await this.assertTaskBelongsToCurrentUser(result.task);
    return result.task;
  }

  private async getTask(taskId: number): Promise<BitrixTask> {
    const result = await this.call<{ task: BitrixTask }>("tasks.task.get", { taskId });
    return result.task;
  }

  private async assertTaskBelongsToCurrentUser(task: BitrixTask): Promise<void> {
    const currentUserId = await this.currentUserId();
    const responsibleId = String(task.responsibleId ?? task.RESPONSIBLE_ID ?? "");

    if (responsibleId !== currentUserId) {
      const taskId = task.id ?? task.ID ?? "unknown";
      throw new Error(`Access denied: task ${taskId} is not assigned to the configured Bitrix24 user.`);
    }
  }

  private async call<T>(method: string, params: unknown): Promise<T> {
    const endpoint = new URL(`${method}.json`, this.webhookUrl).toString();
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json"
      },
      body: JSON.stringify(params ?? {})
    });

    const data = (await response.json()) as BitrixResponse<T>;
    if (!response.ok || data.error) {
      throw new Error(data.error_description || data.error || `Bitrix24 returned HTTP ${response.status}`);
    }
    if (data.result === undefined) {
      throw new Error("Bitrix24 returned an empty result.");
    }

    return data.result;
  }

  private normalizeWebhookUrl(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
      throw new Error("Bitrix24 webhook URL is empty.");
    }

    const url = new URL(trimmed);
    if (url.protocol !== "https:") {
      throw new Error("Bitrix24 webhook URL must use https.");
    }

    return url.toString().replace(/\/+$/, "/");
  }
}
