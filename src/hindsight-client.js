/**
 * Hindsight API Client
 *
 * HTTP client for Hindsight memory server.
 */

export class HindsightClient {
  constructor(options = {}) {
    this.host = options.host || 'localhost';
    this.port = options.port || 8888;
    this.baseUrl = `http://${this.host}:${this.port}`;
  }

  /**
   * Check if Hindsight is available
   */
  async ping() {
    const response = await fetch(`${this.baseUrl}/health`);
    if (!response.ok) {
      throw new Error('Hindsight server unavailable');
    }
    return true;
  }

  /**
   * Store a fact
   */
  async retain(bankId, content, options = {}) {
    const response = await fetch(`${this.baseUrl}/memory/${bankId}/facts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        factType: options.factType || 'WORLD',
        metadata: options.metadata || {},
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to store fact: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Search for facts
   */
  async recall(bankId, query, options = {}) {
    const params = new URLSearchParams({
      query,
      limit: String(options.limit || 10),
    });

    if (options.factType) {
      params.set('factType', options.factType);
    }

    const response = await fetch(
      `${this.baseUrl}/memory/${bankId}/facts/search?${params}`
    );

    if (!response.ok) {
      throw new Error(`Failed to search: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get recent facts
   */
  async recent(bankId, days = 7) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const params = new URLSearchParams({
      since: since.toISOString(),
    });

    const response = await fetch(
      `${this.baseUrl}/memory/${bankId}/facts?${params}`
    );

    if (!response.ok) {
      throw new Error(`Failed to get recent: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Delete a fact
   */
  async forget(bankId, factId) {
    const response = await fetch(
      `${this.baseUrl}/memory/${bankId}/facts/${factId}`,
      { method: 'DELETE' }
    );

    if (!response.ok) {
      throw new Error(`Failed to delete: ${response.statusText}`);
    }
  }
}
