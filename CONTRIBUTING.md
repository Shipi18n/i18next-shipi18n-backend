# Contributing to i18next-shipi18n-backend

Thank you for your interest in contributing to the i18next Shipi18n backend! This document provides guidelines and instructions for contributing.

## How to Contribute

### Reporting Bugs

If you find a bug, please create an issue with:

- A clear, descriptive title
- Steps to reproduce the issue
- Expected vs actual behavior
- Your environment (OS, Node version, i18next version)
- Your i18next configuration
- Code snippet demonstrating the issue
- Error messages or stack traces

### Suggesting Enhancements

We welcome suggestions for new features or improvements! Please create an issue with:

- A clear description of the enhancement
- Why this would be useful for i18next users
- Example use cases
- Any implementation ideas

### Pull Requests

1. **Fork the repository** and create your branch from `main`

```bash
git checkout -b feature/my-new-feature
```

2. **Make your changes**

   - Follow the existing code style
   - Add TypeScript types for new features
   - Add JSDoc comments for public methods
   - Update documentation if needed
   - Ensure compatibility with i18next

3. **Test your changes**

```bash
npm install
npm test
npm run build
```

4. **Commit your changes**

Use clear, descriptive commit messages following [Conventional Commits](https://www.conventionalcommits.org/):

```bash
git commit -m "feat: add retry logic for failed translations"
git commit -m "fix: handle network timeout errors"
git commit -m "docs: update caching configuration examples"
```

5. **Push to your fork**

```bash
git push origin feature/my-new-feature
```

6. **Open a Pull Request**

   - Describe what your PR does
   - Reference any related issues
   - Include usage examples with i18next

## Code Style Guidelines

### TypeScript

- Use TypeScript for all new code
- Export proper types for public APIs
- Use clear, descriptive variable names
- Add JSDoc comments for public methods
- Handle errors gracefully

**Example:**

```typescript
/**
 * Read translations from Shipi18n API
 * @param language - Target language code
 * @param namespace - i18next namespace
 * @param callback - i18next callback function
 */
read(
  language: string,
  namespace: string,
  callback: ReadCallback
): void {
  // Check cache first
  const cacheKey = `${language}:${namespace}`;
  const cached = this.cache.get(cacheKey);

  if (cached && !this.isCacheExpired(cached)) {
    callback(null, cached.data);
    return;
  }

  // Fetch from API
  this.fetchTranslations(language, namespace)
    .then(data => {
      this.cache.set(cacheKey, { data, timestamp: Date.now() });
      callback(null, data);
    })
    .catch(error => {
      callback(error, null);
    });
}
```

### i18next Backend Interface

This package implements the i18next Backend interface. Key methods:

- `init(services, backendOptions, i18nextOptions)` - Initialize the backend
- `read(language, namespace, callback)` - Load translations
- `create(languages, namespace, key, fallbackValue)` - Create missing keys (optional)

Ensure any changes maintain compatibility with the i18next backend contract.

### File Organization

```
i18next-shipi18n-backend/
├── src/
│   ├── index.ts              # Main exports and backend class
│   └── __tests__/
│       └── backend.test.ts   # Jest tests
├── dist/                     # Built files (generated)
├── coverage/                 # Test coverage reports
├── package.json
├── tsconfig.json
└── README.md
```

## Development Setup

### Prerequisites

- Node.js 18+
- npm
- A Shipi18n API key (for integration testing)

### Local Development

1. Clone your fork

```bash
git clone https://github.com/YOUR_USERNAME/i18next-shipi18n-backend.git
cd i18next-shipi18n-backend
```

2. Install dependencies

```bash
npm install
```

3. Build the package

```bash
npm run build
```

4. Link locally for testing

```bash
npm link
```

5. Test in another project

```bash
cd /path/to/your/project
npm link i18next-shipi18n-backend
```

## Testing

Before submitting a PR:

1. Run the full test suite

```bash
npm test
```

2. Run tests with coverage

```bash
npm run test:coverage
```

3. Test the build

```bash
npm run build
```

4. Verify TypeScript types

```bash
npx tsc --noEmit
```

5. Test manually with i18next

```javascript
import i18next from 'i18next';
import Shipi18nBackend from 'i18next-shipi18n-backend';

i18next
  .use(Shipi18nBackend)
  .init({
    backend: {
      apiKey: 'your-api-key',
      sourceLanguage: 'en',
    },
    lng: 'es',
    fallbackLng: 'en',
  })
  .then(() => {
    console.log(i18next.t('greeting'));
  });
```

### Writing Tests

We use Jest for testing. Tests should cover:

- Backend initialization
- Translation loading (read method)
- Caching behavior
- Error handling
- i18next integration

Example test:

```typescript
import Shipi18nBackend from '../index';

describe('Shipi18nBackend', () => {
  let backend: Shipi18nBackend;

  beforeEach(() => {
    backend = new Shipi18nBackend();
  });

  it('should initialize with options', () => {
    backend.init(null, {
      apiKey: 'test-key',
      sourceLanguage: 'en',
    });

    expect(backend).toBeDefined();
  });

  it('should throw error without API key', () => {
    expect(() => {
      backend.init(null, {});
    }).toThrow('apiKey is required');
  });

  it('should use cache when available', (done) => {
    // Test caching behavior
  });
});
```

## Documentation

If you add new features:

- Update README.md with usage examples
- Add TypeScript JSDoc comments
- Document any new configuration options
- Include i18next integration examples
- Update the options table in README

### Configuration Options

When adding new options, document them in the README:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `newOption` | `string` | `'default'` | Description of what this option does |

## Publishing (Maintainers Only)

To publish a new version:

1. Update version in `package.json`

```bash
npm version patch  # or minor, major
```

2. Build and test

```bash
npm run build
npm test
```

3. Publish to npm

```bash
npm publish
```

## Questions?

- Open an issue for questions
- Check existing issues and PRs
- Read the [Shipi18n documentation](https://shipi18n.com/integrations)
- Check the [i18next documentation](https://www.i18next.com/)

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Help others learn and grow
- Keep discussions focused and professional

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to i18next-shipi18n-backend!
