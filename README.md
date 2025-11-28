# i18next-shipi18n-backend

[![npm version](https://img.shields.io/npm/v/i18next-shipi18n-backend.svg)](https://www.npmjs.com/package/i18next-shipi18n-backend)
[![CI](https://github.com/Shipi18n/i18next-shipi18n-backend/actions/workflows/ci.yml/badge.svg)](https://github.com/Shipi18n/i18next-shipi18n-backend/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

i18next backend plugin for [Shipi18n](https://shipi18n.com) translation API. Load translations dynamically and save missing keys automatically.

## Installation

```bash
npm install i18next-shipi18n-backend
```

## Quick Start

```typescript
import i18next from 'i18next';
import Shipi18nBackend from 'i18next-shipi18n-backend';

i18next
  .use(Shipi18nBackend)
  .init({
    lng: 'es',
    fallbackLng: 'en',
    ns: ['common', 'checkout'],
    defaultNS: 'common',
    backend: {
      apiKey: 'your-api-key',
      sourceLanguage: 'en',
    },
  });
```

## Features

- **Load translations from local files** - Use a configurable `loadPath` to load JSON translation files
- **On-the-fly translation** - Automatically translate namespaces using Shipi18n API when local files don't exist
- **Save missing keys** - Automatically collect and report missing translation keys to Shipi18n
- **In-memory caching** - Reduce API calls with configurable TTL caching
- **TypeScript support** - Full type definitions included

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `string` | - | Your Shipi18n API key (required for API features) |
| `apiUrl` | `string` | `https://api.shipi18n.com` | API base URL |
| `sourceLanguage` | `string` | `en` | Source language code for translations |
| `loadPath` | `string \| function` | `/locales/{{lng}}/{{ns}}.json` | Path to load local translations |
| `timeout` | `number` | `10000` | Request timeout in milliseconds |
| `translateOnLoad` | `boolean` | `false` | Auto-translate namespaces if local file missing |
| `cache` | `boolean` | `true` | Enable in-memory caching |
| `cacheTTL` | `number` | `300000` | Cache TTL in milliseconds (5 minutes) |
| `customHeaders` | `object` | - | Custom headers for API requests |
| `parse` | `function` | `JSON.parse` | Custom function to parse response data |
| `onMissingKeysSaved` | `function` | - | Callback when missing keys are saved |
| `onLoadError` | `function` | - | Callback on load error |

## Usage Examples

### Basic Setup with Local Files

```typescript
import i18next from 'i18next';
import Shipi18nBackend from 'i18next-shipi18n-backend';

i18next
  .use(Shipi18nBackend)
  .init({
    lng: 'en',
    fallbackLng: 'en',
    ns: ['common'],
    backend: {
      apiKey: 'your-api-key',
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
  });
```

### Enable On-the-Fly Translation

When `translateOnLoad` is enabled, the backend will automatically translate namespaces using the Shipi18n API if the local translation file doesn't exist:

```typescript
i18next.init({
  lng: 'es',
  fallbackLng: 'en',
  backend: {
    apiKey: 'your-api-key',
    sourceLanguage: 'en',
    translateOnLoad: true,
  },
});
```

### Save Missing Translation Keys

Enable i18next's `saveMissing` option to automatically report missing keys:

```typescript
i18next.init({
  lng: 'en',
  saveMissing: true,
  backend: {
    apiKey: 'your-api-key',
    onMissingKeysSaved: (keys) => {
      console.log('Missing keys saved:', keys);
    },
  },
});

// When using a key that doesn't exist:
t('missing.key', 'Default fallback value');
// The key will be queued and sent to Shipi18n
```

### Custom Load Path Function

```typescript
i18next.init({
  backend: {
    apiKey: 'your-api-key',
    loadPath: (lng, ns) => `/api/translations/${lng}/${ns}`,
  },
});
```

### With React (react-i18next)

```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import Shipi18nBackend from 'i18next-shipi18n-backend';

i18n
  .use(Shipi18nBackend)
  .use(initReactI18next)
  .init({
    lng: 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    backend: {
      apiKey: 'your-api-key',
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
  });

export default i18n;
```

## API Methods

### `clearCache()`

Clear all cached translations:

```typescript
const backend = i18next.services.backendConnector.backend;
backend.clearCache();
```

### `clearCacheFor(language, namespace?)`

Clear cache for a specific language or namespace:

```typescript
const backend = i18next.services.backendConnector.backend;

// Clear all cached translations for Spanish
backend.clearCacheFor('es');

// Clear specific namespace
backend.clearCacheFor('es', 'common');
```

## Error Handling

Use the `onLoadError` callback to handle errors:

```typescript
i18next.init({
  backend: {
    apiKey: 'your-api-key',
    onLoadError: (error, language, namespace) => {
      console.error(`Failed to load ${namespace} for ${language}:`, error);
    },
  },
});
```

## TypeScript

The package includes full TypeScript definitions:

```typescript
import Shipi18nBackend, {
  Shipi18nBackendOptions,
  MissingKey
} from 'i18next-shipi18n-backend';

const options: Shipi18nBackendOptions = {
  apiKey: 'your-api-key',
  translateOnLoad: true,
  onMissingKeysSaved: (keys: MissingKey[]) => {
    keys.forEach(key => console.log(key.key, key.defaultValue));
  },
};
```

## Documentation & Resources

📚 **Full Documentation:** [shipi18n.com/integrations/react](https://shipi18n.com/integrations/react)

| Resource | Link |
|----------|------|
| **Getting Started** | [shipi18n.com](https://shipi18n.com) |
| **API Reference** | [shipi18n.com/api](https://shipi18n.com/api) |
| **i18next Best Practices** | [shipi18n.com/integrations/react](https://shipi18n.com/integrations/react) |
| **Blog & Tutorials** | [shipi18n.com/blog](https://shipi18n.com/blog) |

## Related Packages

| Package | Description |
|---------|-------------|
| [@shipi18n/api](https://www.npmjs.com/package/@shipi18n/api) | Node.js SDK for programmatic use |
| [@shipi18n/cli](https://www.npmjs.com/package/@shipi18n/cli) | CLI tool for translating files |
| [vite-plugin-shipi18n](https://www.npmjs.com/package/vite-plugin-shipi18n) | Vite plugin for build-time translation |
| [shipi18n-github-action](https://github.com/marketplace/actions/shipi18n-auto-translate) | GitHub Action for CI/CD |

## Examples

- [Node.js Example](https://github.com/Shipi18n/shipi18n-nodejs-example) - Basic usage examples
- [Vue Example](https://github.com/Shipi18n/shipi18n-vue-example) - Vue 3 + vue-i18n integration

## License

MIT

---

<p align="center">
  <a href="https://shipi18n.com">shipi18n.com</a> ·
  <a href="https://github.com/Shipi18n">GitHub</a> ·
  <a href="https://shipi18n.com/pricing">Pricing</a>
</p>
