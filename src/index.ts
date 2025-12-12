/**
 * i18next-shipi18n-backend
 *
 * i18next backend plugin for Shipi18n translation API.
 * Load translations dynamically and save missing keys automatically.
 *
 * @example
 * ```typescript
 * import i18next from 'i18next';
 * import Shipi18nBackend from 'i18next-shipi18n-backend';
 *
 * i18next
 *   .use(Shipi18nBackend)
 *   .init({
 *     lng: 'es',
 *     fallbackLng: 'en',
 *     ns: ['common', 'checkout'],
 *     defaultNS: 'common',
 *     backend: {
 *       apiKey: 'your-api-key',
 *       sourceLanguage: 'en',
 *       // Optional: translate on-the-fly if translation missing
 *       translateOnLoad: true,
 *     },
 *   });
 * ```
 */

import type { BackendModule, InitOptions, ReadCallback, Services } from 'i18next';

export interface Shipi18nBackendOptions {
  /** Your Shipi18n API key (required for API features) */
  apiKey?: string;

  /** API base URL (default: https://ydjkwckq3f.execute-api.us-east-1.amazonaws.com) */
  apiUrl?: string;

  /** Source language code for translations (default: 'en') */
  sourceLanguage?: string;

  /** Path to load local translations from (default: '/locales/{{lng}}/{{ns}}.json') */
  loadPath?: string | ((lng: string, ns: string) => string);

  /** Request timeout in milliseconds (default: 10000) */
  timeout?: number;

  /** Custom headers to include in API requests */
  customHeaders?: Record<string, string>;

  /** Enable translation on load if namespace doesn't exist locally (default: false) */
  translateOnLoad?: boolean;

  /** Enable in-memory caching (default: true) */
  cache?: boolean;

  /** Cache TTL in milliseconds (default: 300000 - 5 minutes) */
  cacheTTL?: number;

  /** Callback when missing keys are saved */
  onMissingKeysSaved?: (keys: MissingKey[]) => void;

  /** Callback on load error */
  onLoadError?: (error: Error, lng: string, ns: string) => void;

  /** Parse response data before returning (default: identity function) */
  parse?: (data: string) => Record<string, unknown>;
}

export interface MissingKey {
  key: string;
  defaultValue?: string;
  namespace: string;
  language: string;
}

interface CacheEntry {
  data: Record<string, unknown>;
  timestamp: number;
}

const defaultOptions: Shipi18nBackendOptions = {
  apiKey: '',
  apiUrl: 'https://ydjkwckq3f.execute-api.us-east-1.amazonaws.com',
  sourceLanguage: 'en',
  loadPath: '/locales/{{lng}}/{{ns}}.json',
  timeout: 10000,
  translateOnLoad: false,
  cache: true,
  cacheTTL: 300000, // 5 minutes
  parse: (data: string) => JSON.parse(data),
};

class Shipi18nBackend implements BackendModule<Shipi18nBackendOptions> {
  static type = 'backend' as const;
  type = 'backend' as const;

  private services!: Services;
  private options!: Shipi18nBackendOptions;
  private i18nextOptions!: InitOptions | Record<string, unknown>;
  private cache: Map<string, CacheEntry> = new Map();
  private missingKeyQueue: MissingKey[] = [];
  private flushTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(services?: Services, options?: Shipi18nBackendOptions, i18nextOptions?: Record<string, unknown>) {
    if (services && options) {
      this.init(services, options, i18nextOptions);
    }
  }

  /**
   * Initialize the backend plugin
   */
  init(
    services: Services,
    backendOptions: Shipi18nBackendOptions,
    i18nextOptions?: InitOptions
  ): void {
    this.services = services;
    this.options = { ...defaultOptions, ...backendOptions };
    this.i18nextOptions = i18nextOptions || {};

    if (!this.options.apiKey) {
      console.warn(
        '[i18next-shipi18n-backend] Warning: No API key provided. ' +
        'Translation and saveMissing features will not work. ' +
        'Get your API key at https://shipi18n.com'
      );
    }
  }

  /**
   * Read translations for a language/namespace combination
   */
  read(language: string, namespace: string, callback: ReadCallback): void {
    // Check cache first
    const cacheKey = `${language}:${namespace}`;
    if (this.options.cache) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < (this.options.cacheTTL || 300000)) {
        callback(null, cached.data);
        return;
      }
    }

    // Try loading from local path first
    this.loadFromPath(language, namespace)
      .then((data) => {
        if (data) {
          this.setCache(cacheKey, data);
          callback(null, data);
        } else if (this.options.translateOnLoad && this.options.apiKey) {
          // If translateOnLoad is enabled and we have source translations, translate them
          this.translateNamespace(language, namespace)
            .then((translatedData) => {
              if (translatedData) {
                this.setCache(cacheKey, translatedData);
                callback(null, translatedData);
              } else {
                callback(null, {});
              }
            })
            .catch((error) => {
              this.handleLoadError(error, language, namespace);
              callback(null, {});
            });
        } else {
          callback(null, {});
        }
      })
      .catch((error) => {
        this.handleLoadError(error, language, namespace);
        callback(null, {});
      });
  }

  /**
   * Save missing translation keys (called when saveMissing is enabled)
   */
  create(
    languages: readonly string[] | string,
    namespace: string,
    key: string,
    fallbackValue: string
  ): void {
    const lngs = typeof languages === 'string' ? [languages] : [...languages];

    for (const lng of lngs) {
      this.missingKeyQueue.push({
        key,
        defaultValue: fallbackValue,
        namespace,
        language: lng,
      });
    }

    // Debounce the flush to batch multiple missing keys
    this.scheduleFlush();
  }

  /**
   * Load translations from local path
   */
  private async loadFromPath(
    language: string,
    namespace: string
  ): Promise<Record<string, unknown> | null> {
    const loadPath = this.options.loadPath;
    if (!loadPath) return null;

    const url =
      typeof loadPath === 'function'
        ? loadPath(language, namespace)
        : loadPath.replace('{{lng}}', language).replace('{{ns}}', namespace);

    try {
      const response = await this.fetchWithTimeout(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          ...this.options.customHeaders,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null; // File not found is not an error
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const text = await response.text();
      const parse = this.options.parse || JSON.parse;
      return parse(text);
    } catch (error) {
      // Network errors or 404s are expected for missing translations
      if ((error as Error).message?.includes('fetch')) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Translate a namespace on-the-fly using Shipi18n API
   */
  private async translateNamespace(
    targetLanguage: string,
    namespace: string
  ): Promise<Record<string, unknown> | null> {
    if (!this.options.apiKey) return null;

    const sourceLanguage = this.options.sourceLanguage || 'en';

    // Load source translations first
    const sourceData = await this.loadFromPath(sourceLanguage, namespace);
    if (!sourceData || Object.keys(sourceData).length === 0) {
      return null;
    }

    try {
      const response = await this.fetchWithTimeout(
        `${this.options.apiUrl}/api/translate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.options.apiKey,
            ...this.options.customHeaders,
          },
          body: JSON.stringify({
            inputMethod: 'text',
            text: JSON.stringify(sourceData),
            sourceLanguage,
            targetLanguages: JSON.stringify([targetLanguage]),
            outputFormat: 'json',
            preservePlaceholders: 'true',
            enablePluralization: 'true',
            namespace,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as { message?: string };
        throw new Error(errorData.message || `API error: ${response.status}`);
      }

      const result = await response.json() as Record<string, unknown>;

      // Parse the translation result
      const translation = result[targetLanguage];
      if (typeof translation === 'string') {
        return JSON.parse(translation) as Record<string, unknown>;
      }
      return (translation as Record<string, unknown>) || null;
    } catch (error) {
      console.error('[i18next-shipi18n-backend] Translation error:', error);
      throw error;
    }
  }

  /**
   * Schedule a flush of missing keys to the API
   */
  private scheduleFlush(): void {
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
    }

    // Debounce for 1 second to batch multiple missing keys
    this.flushTimeout = setTimeout(() => {
      this.flushMissingKeys();
    }, 1000);
  }

  /**
   * Flush missing keys to the Shipi18n API
   */
  private async flushMissingKeys(): Promise<void> {
    if (this.missingKeyQueue.length === 0 || !this.options.apiKey) {
      return;
    }

    const keysToSend = [...this.missingKeyQueue];
    this.missingKeyQueue = [];

    try {
      const response = await this.fetchWithTimeout(
        `${this.options.apiUrl}/api/keys/missing`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.options.apiKey,
            ...this.options.customHeaders,
          },
          body: JSON.stringify({ keys: keysToSend }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to save missing keys: ${response.status}`);
      }

      // Notify callback if provided
      if (this.options.onMissingKeysSaved) {
        this.options.onMissingKeysSaved(keysToSend);
      }
    } catch (error) {
      console.error('[i18next-shipi18n-backend] Failed to save missing keys:', error);
      // Re-queue the keys for retry
      this.missingKeyQueue.push(...keysToSend);
    }
  }

  /**
   * Fetch with timeout support
   */
  private async fetchWithTimeout(
    url: string,
    options: RequestInit
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      this.options.timeout || 10000
    );

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if ((error as Error).name === 'AbortError') {
        throw new Error('Request timed out');
      }
      throw error;
    }
  }

  /**
   * Set cache entry
   */
  private setCache(key: string, data: Record<string, unknown>): void {
    if (this.options.cache) {
      this.cache.set(key, {
        data,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Clear all cached translations
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clear cache for specific language/namespace
   */
  clearCacheFor(language: string, namespace?: string): void {
    if (namespace) {
      this.cache.delete(`${language}:${namespace}`);
    } else {
      // Clear all entries for this language
      for (const key of this.cache.keys()) {
        if (key.startsWith(`${language}:`)) {
          this.cache.delete(key);
        }
      }
    }
  }

  /**
   * Handle load errors
   */
  private handleLoadError(error: Error, language: string, namespace: string): void {
    if (this.options.onLoadError) {
      this.options.onLoadError(error, language, namespace);
    }
  }

  /**
   * Get current options (for testing)
   */
  getOptions(): Shipi18nBackendOptions {
    return { ...this.options };
  }
}

export default Shipi18nBackend;
export { Shipi18nBackend };
