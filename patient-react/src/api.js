const API_BASE = "";

let token = localStorage.getItem("token");

export function setToken(value) {
  token = value;

  if (value) {
    localStorage.setItem("token", value);
  } else {
    localStorage.removeItem("token");
  }
}

export function getToken() {
  return token;
}

export async function apiCall(path, options = {}) {
  const { method = "GET", body } = options;

  let response;

  try {
    response = await fetch(`${API_BASE}/api${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(method !== "GET"
        ? { body: JSON.stringify(body ?? {}) }
        : {}),
      signal: AbortSignal.timeout(60000),
    });
  } catch (error) {
    throw new Error(
      `Cannot connect to backend at ${API_BASE}. Details: ${error.message}`
    );
  }

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error(
      `Invalid server response (HTTP ${response.status}).`
    );
  }

  if (!response.ok) {
    throw new Error(result?.error || "Request failed");
  }

  return result;
}
