
const API_BASE = '/api'

type ApiOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  token?: string
}

export async function apiRequest<T>(
  path: string,
  options: ApiOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  }

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? 'GET',
    headers,
    credentials: 'include',
    body:
      options.body === undefined
        ? undefined
        : JSON.stringify(options.body),
  })

  if (!response.ok) {
    let message = `Ошибка запроса: ${response.status}`

    try {
      const data = await response.json()
      message =
        typeof data.detail === 'string'
          ? data.detail
          : JSON.stringify(data.detail ?? data)
    } catch {
      // Если сервер вернул не JSON используем сообщение выше
    }

    throw new Error(message)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}
