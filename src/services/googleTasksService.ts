/**
 * Google Tasks API Client Service for Pulsar
 *
 * Implements client-side token pattern to communicate with Google Tasks API:
 * - https://www.googleapis.com/auth/tasks
 * - https://www.googleapis.com/auth/tasks.readonly
 *
 * Tokens are passed via client Authorization headers in memory.
 */

export interface GoogleTaskList {
  id: string;
  title: string;
  updated?: string;
  selfLink?: string;
}

export interface GoogleTask {
  id: string;
  title: string;
  updated?: string;
  selfLink?: string;
  parent?: string;
  position?: string;
  notes?: string;
  status: 'needsAction' | 'completed';
  due?: string; // RFC 3339 timestamp
  completed?: string;
  deleted?: boolean;
  hidden?: boolean;
}

const API_BASE = 'https://tasks.googleapis.com/tasks/v1';

class GoogleTasksService {
  /**
   * Helper to execute authorized Google Tasks REST requests
   */
  private async request<T>(endpoint: string, accessToken: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${accessToken}`);
    if (options.body && typeof options.body === 'string') {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });

    if (response.status === 204) {
      return {} as T;
    }

    if (!response.ok) {
      let errorMsg = `Google Tasks API error (${response.status} ${response.statusText})`;
      try {
        const errJson = await response.json();
        if (errJson?.error?.message) {
          errorMsg = errJson.error.message;
        }
      } catch {
        // use fallback message
      }
      throw new Error(errorMsg);
    }

    return response.json();
  }

  /**
   * List all task lists for the current authenticated user
   */
  async listTaskLists(accessToken: string): Promise<GoogleTaskList[]> {
    const res = await this.request<{ items?: GoogleTaskList[] }>('/users/@me/lists?maxResults=100', accessToken);
    return res.items || [];
  }

  /**
   * Create a new task list
   */
  async createTaskList(accessToken: string, title: string): Promise<GoogleTaskList> {
    return this.request<GoogleTaskList>('/users/@me/lists', accessToken, {
      method: 'POST',
      body: JSON.stringify({ title: title.trim() })
    });
  }

  /**
   * Get or automatically create the default Pulsar TaskList
   */
  async getOrCreatePulsarTaskList(accessToken: string, preferredTitle = 'Pulsar Sales & Pipeline Tasks'): Promise<GoogleTaskList> {
    const lists = await this.listTaskLists(accessToken);
    const existing = lists.find(l => l.title.toLowerCase() === preferredTitle.toLowerCase());
    if (existing) {
      return existing;
    }
    // Return primary if exists or create dedicated Pulsar list
    if (lists.length > 0 && lists[0].id === '@default') {
      // Create dedicated list for clarity
      try {
        return await this.createTaskList(accessToken, preferredTitle);
      } catch {
        return lists[0];
      }
    }
    return this.createTaskList(accessToken, preferredTitle);
  }

  /**
   * List tasks within a task list
   */
  async listTasks(
    accessToken: string, 
    taskListId: string = '@default', 
    showCompleted = true
  ): Promise<GoogleTask[]> {
    const query = new URLSearchParams({
      maxResults: '100',
      showCompleted: String(showCompleted),
      showHidden: 'true'
    });
    const res = await this.request<{ items?: GoogleTask[] }>(
      `/lists/${encodeURIComponent(taskListId)}/tasks?${query.toString()}`,
      accessToken
    );
    return res.items || [];
  }

  /**
   * Create a new task in Google Tasks
   */
  async createTask(
    accessToken: string,
    taskListId: string,
    task: {
      title: string;
      notes?: string;
      due?: string; // RFC 3339 timestamp (e.g. 2026-10-15T00:00:00.000Z)
    }
  ): Promise<GoogleTask> {
    const payload: Partial<GoogleTask> = {
      title: task.title,
      notes: task.notes || undefined,
      status: 'needsAction'
    };
    if (task.due) {
      payload.due = task.due;
    }

    return this.request<GoogleTask>(
      `/lists/${encodeURIComponent(taskListId)}/tasks`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify(payload)
      }
    );
  }

  /**
   * Update task details (title, notes, due date)
   */
  async updateTask(
    accessToken: string,
    taskListId: string,
    taskId: string,
    updates: Partial<GoogleTask>
  ): Promise<GoogleTask> {
    return this.request<GoogleTask>(
      `/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(taskId)}`,
      accessToken,
      {
        method: 'PATCH',
        body: JSON.stringify(updates)
      }
    );
  }

  /**
   * Toggle task completion state
   */
  async toggleTaskStatus(
    accessToken: string,
    taskListId: string,
    taskId: string,
    completed: boolean
  ): Promise<GoogleTask> {
    return this.updateTask(accessToken, taskListId, taskId, {
      status: completed ? 'completed' : 'needsAction'
    });
  }

  /**
   * Delete a task from Google Tasks
   */
  async deleteTask(
    accessToken: string,
    taskListId: string,
    taskId: string
  ): Promise<void> {
    await this.request<void>(
      `/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(taskId)}`,
      accessToken,
      {
        method: 'DELETE'
      }
    );
  }

  /**
   * Clear all completed tasks from the specified task list
   */
  async clearCompletedTasks(
    accessToken: string,
    taskListId: string
  ): Promise<void> {
    await this.request<void>(
      `/lists/${encodeURIComponent(taskListId)}/clear`,
      accessToken,
      {
        method: 'POST'
      }
    );
  }
}

export const googleTasksService = new GoogleTasksService();
