# use-secure-query

A Next.js-compatible React hook for encrypted URL parameters with multiple encryption modes and features. This hook provides a secure way to handle sensitive data in URL parameters by encrypting them.

## Features

- 🔒 Multiple encryption modes
- 🎯 Per-parameter or single-bundle encryption
- 🛡️ Tamper detection with automatic redirect
- 🧹 Empty value stripping
- ⚡ Ultra-fast XOR-Base64 implementation
- 🔄 Next.js 14+ compatible(app directory structure)
- 📦 Zero dependencies
- 🎨 TypeScript support

## Installation

```bash
# Using npm
npm install use-secure-query

# Using yarn
yarn add use-secure-query

# Using pnpm
pnpm add use-secure-query
```

## Quick Start

```tsx
import useSecureQuery from "use-secure-query";

function MyComponent() {
  const { query, pushEncrypted } = useSecureQuery({
    // Optional configuration
    allowList: ["id", "type"],
    mode: "perParam",
    encryptionMode: "all",
  });

  // Use the hook
  const handleClick = () => {
    pushEncrypted("/dashboard", {
      userId: "123",
      role: "admin",
    });
  };

  return (
    <div>
      <p>User ID: {query.userId}</p>
      <button onClick={handleClick}>Go to Dashboard</button>
    </div>
  );
}
```

## Configuration Options

```typescript
interface Options {
  allowList?: string[]; // List of parameters to control encryption behavior
  secret?: string; // XOR secret (env-driven by default)
  mode?: "perParam" | "single"; // Encryption mode
  bundleKey?: string; // When mode='single'; default 'q'
  encryptionMode?: "all" | "pure" | "encrypt"; // Controls which parameters get encrypted
  notFoundPath?: string; // Override 404 target; default '/404'
}
```

### Encryption Modes

#### Per-Parameter Mode (default)

Each query-string value is encrypted individually.

#### Single Mode

All non-allow-listed params are bundled → JSON → encrypted → stuffed into one key (default: "q"), giving very short URLs.

### Encryption Behavior

#### All Mode (default)

Encrypts all URL parameters regardless of allowList

```
?id=123&type=user&name=john → ?id=encrypted&type=encrypted&name=encrypted
```

#### Pure Mode

Only encrypts parameters that are specified in allowList

```
?id=123&type=user&name=john → ?id=encrypted&type=encrypted&name=john
```

#### Encrypt Mode

Encrypts all parameters EXCEPT those in allowList

```
?id=123&type=user&name=john → ?id=123&type=user&name=encrypted
```

## API

The hook returns an object with the following properties:

```typescript
{
  query: Record<string, string>;        // Decrypted key → value map (Memoized)
  encrypt: (value: string) => string;   // Low-level encryption helper
  decrypt: (value: string) => string | null;   // Low-level decryption helper (returns null if tampering detected)
  pushEncrypted: (path: string, params: Record<string, string | number | boolean | null | undefined>) => void;  // router.push with auto-encryption
  replaceEncrypted: (path: string, params: Record<string, string | number | boolean | null | undefined>) => void;  // router.replace with auto-encryption
  pathname: string;                     // Current pathname
}
```

## Environment Variables

By default, the hook uses the `NEXT_PUBLIC_ENCRYPTION_KEY` environment variable for encryption. You can set this in your `.env.local` file:

```env
NEXT_PUBLIC_ENCRYPTION_KEY=your-secret-key-here
```

## Security Considerations

1. The encryption is based on XOR with Base64 encoding, which provides basic obfuscation but is not suitable for highly sensitive data.
2. Always use HTTPS in production to prevent man-in-the-middle attacks.
3. Consider using a strong, unique encryption key for each environment.
4. The hook automatically redirects to a 404 page if tampering is detected.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT © Naeim Abdi
