import Shipi18nBackend, { Shipi18nBackendOptions } from '../index';

// Mock fetch globally
const originalFetch = global.fetch;

function createMockFetch(responses: Record<string, {
  ok: boolean;
  status: number;
  statusText?: string;
  data?: unknown;
  text?: string;
}>) {
  return jest.fn(async (url: string) => {
    const response = responses[url] || responses['default'] || { ok: true, status: 200, data: {} };
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText || 'OK',
      json: async () => response.data,
      text: async () => response.text || JSON.stringify(response.data),
    };
  });
}

afterAll(() => {
  global.fetch = originalFetch;
});

beforeEach(() => {
  jest.clearAllMocks();
  // Reset to default mock
  global.fetch = createMockFetch({
    'default': { ok: true, status: 200, data: {} }
  }) as unknown as typeof fetch;
});

describe('Shipi18nBackend', () => {
  describe('static properties', () => {
    it('has type set to backend', () => {
      expect(Shipi18nBackend.type).toBe('backend');
    });

    it('instance has type set to backend', () => {
      const backend = new Shipi18nBackend();
      expect(backend.type).toBe('backend');
    });
  });

  describe('constructor', () => {
    it('creates instance without arguments', () => {
      const backend = new Shipi18nBackend();
      expect(backend).toBeInstanceOf(Shipi18nBackend);
    });

    it('initializes with services and options', () => {
      const services = {} as any;
      const options: Shipi18nBackendOptions = { apiKey: 'test-key' };

      const backend = new Shipi18nBackend(services, options);

      expect(backend.getOptions().apiKey).toBe('test-key');
    });
  });

  describe('init', () => {
    it('merges options with defaults', () => {
      const backend = new Shipi18nBackend();
      backend.init({} as any, { apiKey: 'my-key' });

      const options = backend.getOptions();
      expect(options.apiKey).toBe('my-key');
      expect(options.apiUrl).toBe('https://api.shipi18n.com');
      expect(options.sourceLanguage).toBe('en');
      expect(options.timeout).toBe(10000);
      expect(options.cache).toBe(true);
    });

    it('warns when no API key provided', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const backend = new Shipi18nBackend();
      backend.init({} as any, {});

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No API key provided')
      );
      consoleSpy.mockRestore();
    });

    it('does not warn when API key is provided', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const backend = new Shipi18nBackend();
      backend.init({} as any, { apiKey: 'test-key' });

      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('read', () => {
    it('loads translations from loadPath', async () => {
      global.fetch = createMockFetch({
        'default': {
          ok: true,
          status: 200,
          data: { greeting: 'Hola', farewell: 'Adiós' },
        }
      }) as unknown as typeof fetch;

      const backend = new Shipi18nBackend();
      backend.init({} as any, { apiKey: 'test-key' });

      const result = await new Promise<Record<string, unknown>>((resolve) => {
        backend.read('es', 'common', (err, data) => {
          resolve(data as Record<string, unknown>);
        });
      });

      expect(result).toEqual({ greeting: 'Hola', farewell: 'Adiós' });
    });

    it('returns empty object on 404', async () => {
      global.fetch = createMockFetch({
        'default': {
          ok: false,
          status: 404,
          statusText: 'Not Found',
        }
      }) as unknown as typeof fetch;

      const backend = new Shipi18nBackend();
      backend.init({} as any, { apiKey: 'test-key' });

      const result = await new Promise<Record<string, unknown>>((resolve) => {
        backend.read('es', 'missing', (err, data) => {
          resolve(data as Record<string, unknown>);
        });
      });

      expect(result).toEqual({});
    });

    it('uses cached data within TTL', async () => {
      const mockFetch = createMockFetch({
        'default': {
          ok: true,
          status: 200,
          data: { greeting: 'Hola' },
        }
      });
      global.fetch = mockFetch as unknown as typeof fetch;

      const backend = new Shipi18nBackend();
      backend.init({} as any, { apiKey: 'test-key', cache: true, cacheTTL: 60000 });

      // First read - should fetch
      await new Promise<void>((resolve) => {
        backend.read('es', 'common', () => resolve());
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second read - should use cache
      await new Promise<void>((resolve) => {
        backend.read('es', 'common', () => resolve());
      });

      expect(mockFetch).toHaveBeenCalledTimes(1); // Still only 1 call
    });

    it('supports function loadPath', async () => {
      const mockFetch = createMockFetch({
        'default': {
          ok: true,
          status: 200,
          data: { key: 'value' },
        }
      });
      global.fetch = mockFetch as unknown as typeof fetch;

      const loadPath = jest.fn((lng: string, ns: string) => `/api/locales/${lng}/${ns}`);

      const backend = new Shipi18nBackend();
      backend.init({} as any, { apiKey: 'test-key', loadPath });

      await new Promise<void>((resolve) => {
        backend.read('fr', 'translation', () => resolve());
      });

      expect(loadPath).toHaveBeenCalledWith('fr', 'translation');
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/locales/fr/translation',
        expect.any(Object)
      );
    });

    it('calls onLoadError callback on error', async () => {
      global.fetch = createMockFetch({
        'default': {
          ok: false,
          status: 500,
          statusText: 'Server Error',
        }
      }) as unknown as typeof fetch;

      const onLoadError = jest.fn();
      const backend = new Shipi18nBackend();
      backend.init({} as any, { apiKey: 'test-key', onLoadError });

      await new Promise<void>((resolve) => {
        backend.read('es', 'common', () => resolve());
      });

      expect(onLoadError).toHaveBeenCalledWith(
        expect.any(Error),
        'es',
        'common'
      );
    });
  });

  describe('read with translateOnLoad', () => {
    it('translates namespace when translateOnLoad is enabled and local file missing', async () => {
      global.fetch = jest.fn(async (url: string) => {
        if (url.includes('/locales/es/')) {
          return { ok: false, status: 404, statusText: 'Not Found' };
        }
        if (url.includes('/locales/en/')) {
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ greeting: 'Hello' }),
          };
        }
        if (url.includes('/api/translate')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ es: { greeting: 'Hola' } }),
          };
        }
        return { ok: false, status: 404 };
      }) as unknown as typeof fetch;

      const backend = new Shipi18nBackend();
      backend.init({} as any, {
        apiKey: 'test-key',
        translateOnLoad: true,
        sourceLanguage: 'en',
      });

      const result = await new Promise<Record<string, unknown>>((resolve) => {
        backend.read('es', 'common', (err, data) => {
          resolve(data as Record<string, unknown>);
        });
      });

      expect(result).toEqual({ greeting: 'Hola' });
    });
  });

  describe('create (saveMissing)', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('queues missing keys', () => {
      const backend = new Shipi18nBackend();
      backend.init({} as any, { apiKey: 'test-key' });

      backend.create(['en'], 'common', 'missing.key', 'Default value');

      // Key is queued but not sent yet (debounced)
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('flushes missing keys after debounce', async () => {
      const mockFetch = createMockFetch({
        'default': { ok: true, status: 200, data: { success: true } }
      });
      global.fetch = mockFetch as unknown as typeof fetch;

      const backend = new Shipi18nBackend();
      backend.init({} as any, { apiKey: 'test-key' });

      backend.create(['en'], 'common', 'key1', 'Value 1');
      backend.create(['en'], 'common', 'key2', 'Value 2');

      // Fast-forward past debounce
      await jest.advanceTimersByTimeAsync(1100);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.shipi18n.com/api/keys/missing',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('key1'),
        })
      );
    });

    it('calls onMissingKeysSaved callback', async () => {
      const mockFetch = createMockFetch({
        'default': { ok: true, status: 200, data: { success: true } }
      });
      global.fetch = mockFetch as unknown as typeof fetch;

      const onMissingKeysSaved = jest.fn();
      const backend = new Shipi18nBackend();
      backend.init({} as any, { apiKey: 'test-key', onMissingKeysSaved });

      backend.create('en', 'common', 'new.key', 'New value');

      // Advance timers and flush promises
      await jest.advanceTimersByTimeAsync(1100);

      expect(onMissingKeysSaved).toHaveBeenCalledWith([
        {
          key: 'new.key',
          defaultValue: 'New value',
          namespace: 'common',
          language: 'en',
        },
      ]);
    });

    it('handles string language parameter', () => {
      const backend = new Shipi18nBackend();
      backend.init({} as any, { apiKey: 'test-key' });

      // Should not throw
      backend.create('en', 'common', 'key', 'value');
    });

    it('handles array language parameter', () => {
      const backend = new Shipi18nBackend();
      backend.init({} as any, { apiKey: 'test-key' });

      // Should not throw
      backend.create(['en', 'de'], 'common', 'key', 'value');
    });
  });

  describe('clearCache', () => {
    it('clears all cached entries', async () => {
      const mockFetch = createMockFetch({
        'default': {
          ok: true,
          status: 200,
          data: { key: 'value' },
        }
      });
      global.fetch = mockFetch as unknown as typeof fetch;

      const backend = new Shipi18nBackend();
      backend.init({} as any, { apiKey: 'test-key', cache: true });

      // First read - populates cache
      await new Promise<void>((resolve) => {
        backend.read('es', 'common', () => resolve());
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Clear cache
      backend.clearCache();

      // Second read - should fetch again
      await new Promise<void>((resolve) => {
        backend.read('es', 'common', () => resolve());
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('clearCacheFor', () => {
    it('clears cache for specific language and namespace', async () => {
      const mockFetch = createMockFetch({
        'default': {
          ok: true,
          status: 200,
          data: { key: 'value' },
        }
      });
      global.fetch = mockFetch as unknown as typeof fetch;

      const backend = new Shipi18nBackend();
      backend.init({} as any, { apiKey: 'test-key', cache: true });

      // Populate cache for multiple languages
      await new Promise<void>((resolve) => {
        backend.read('es', 'common', () => resolve());
      });
      await new Promise<void>((resolve) => {
        backend.read('fr', 'common', () => resolve());
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Clear only Spanish cache
      backend.clearCacheFor('es', 'common');

      // Spanish should re-fetch
      await new Promise<void>((resolve) => {
        backend.read('es', 'common', () => resolve());
      });

      expect(mockFetch).toHaveBeenCalledTimes(3);

      // French should still be cached
      await new Promise<void>((resolve) => {
        backend.read('fr', 'common', () => resolve());
      });

      expect(mockFetch).toHaveBeenCalledTimes(3); // No new fetch
    });

    it('clears all namespaces for a language when namespace not specified', async () => {
      const mockFetch = createMockFetch({
        'default': {
          ok: true,
          status: 200,
          data: { key: 'value' },
        }
      });
      global.fetch = mockFetch as unknown as typeof fetch;

      const backend = new Shipi18nBackend();
      backend.init({} as any, { apiKey: 'test-key', cache: true });

      // Populate cache
      await new Promise<void>((resolve) => {
        backend.read('es', 'common', () => resolve());
      });
      await new Promise<void>((resolve) => {
        backend.read('es', 'checkout', () => resolve());
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Clear all Spanish cache
      backend.clearCacheFor('es');

      // Both should re-fetch
      await new Promise<void>((resolve) => {
        backend.read('es', 'common', () => resolve());
      });
      await new Promise<void>((resolve) => {
        backend.read('es', 'checkout', () => resolve());
      });

      expect(mockFetch).toHaveBeenCalledTimes(4);
    });
  });

  describe('custom parse function', () => {
    it('uses custom parse function', async () => {
      global.fetch = jest.fn(async () => ({
        ok: true,
        status: 200,
        text: async () => '{"greeting":"Hola"}',
        json: async () => ({ greeting: 'Hola' }),
      })) as unknown as typeof fetch;

      const parse = jest.fn((data: string) => {
        const parsed = JSON.parse(data);
        return Object.fromEntries(
          Object.entries(parsed).map(([k, v]) => [k, `prefix:${v}`])
        );
      });

      const backend = new Shipi18nBackend();
      backend.init({} as any, { apiKey: 'test-key', parse });

      const result = await new Promise<Record<string, unknown>>((resolve) => {
        backend.read('es', 'common', (err, data) => {
          resolve(data as Record<string, unknown>);
        });
      });

      expect(parse).toHaveBeenCalled();
      expect(result).toEqual({ greeting: 'prefix:Hola' });
    });
  });

  describe('API error handling', () => {
    it('handles API errors gracefully', async () => {
      global.fetch = createMockFetch({
        'default': {
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          data: { message: 'Invalid API key' },
        }
      }) as unknown as typeof fetch;

      const onLoadError = jest.fn();
      const backend = new Shipi18nBackend();
      backend.init({} as any, { apiKey: 'bad-key', onLoadError });

      await new Promise<void>((resolve) => {
        backend.read('es', 'common', () => resolve());
      });

      expect(onLoadError).toHaveBeenCalled();
    });
  });
});

describe('Default export', () => {
  it('exports Shipi18nBackend as default', () => {
    expect(Shipi18nBackend).toBeDefined();
    expect(Shipi18nBackend.type).toBe('backend');
  });
});
