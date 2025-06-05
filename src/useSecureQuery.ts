/*
 * 1.0.0 – 2025-06-05
 * • First public release
 * • perParam + single modes
 * • allowList, encryptionMode, tamper redirect
 *
 * useSecureQuery — Next.js 15 hook for encrypted URL parameters
 * =========================================================================
 * Two operating modes:
 *  ➤ **perParam** (default) ‑ each query‑string value is encrypted individually.
 *  ➤ **single**  ‑ all non‑allow‑listed params are bundled → JSON → encrypted →
 *    stuffed into one key (default: "q"), giving very short URLs.
 *
 * Encryption Modes (for perParam mode)
 * ------------------------------------
 * • **all** (default) - Encrypts all URL parameters regardless of allowList
 * • **pure** - Only encrypts parameters that are specified in allowList
 * • **encrypt** - Encrypts all parameters EXCEPT those in allowList
 *
 * Examples:
 * ---------
 * allowList = ['id', 'type']
 *
 * all mode:
 *   ?id=123&type=user&name=john → ?id=encrypted&type=encrypted&name=encrypted
 *
 * pure mode:
 *   ?id=123&type=user&name=john → ?id=encrypted&type=encrypted&name=john
 *
 * encrypt mode:
 *   ?id=123&type=user&name=john → ?id=123&type=user&name=encrypted
 *
 * Extra features
 * -------------
 * • **Empty‑value stripping** → any param whose value is `'' | null | undefined`
 *   is omitted from both the generated URL and the returned `query` map.
 * • **Tamper detection** → if decryption fails (e.g., a character is missing),
 *   the hook auto‑redirects the user to `/404` (Next.js not‑found page).
 *
 * Options
 * -------
 * allowList?: string[]        // List of parameters to control encryption behavior
 * secret?: string             // XOR secret (env‑driven by default)
 * mode?: 'perParam' | 'single'
 * bundleKey?: string          // when mode='single'; default 'q'
 * encryptionMode?: 'all' | 'pure' | 'encrypt'  // Controls which parameters get encrypted
 * notFoundPath?: string       // override 404 target; default '/404'
 *
 * Public API (both modes)
 * ----------------------
 * const {
 *   query,                // decrypted key → value map (Memoized)
 *   encrypt, decrypt,     // low‑level helpers
 *   pushEncrypted,        // router.push with auto‑encryption
 *   replaceEncrypted,     // router.replace with auto‑encryption
 *   pathname
 * } = useSecureQuery(opts);
 */

"use client";

import { useCallback, useMemo, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";

/* ---------------- Types ---------------- */
interface Options {
  allowList?: string[];
  secret?: string;
  mode?: "perParam" | "single";
  bundleKey?: string; // only for mode='single'
  encryptionMode?: "all" | "pure" | "encrypt"; // only for mode='perParam'
  notFoundPath?: string;
}

const DEFAULT_SECRET =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_ENCRYPTION_KEY
    ? (process.env.NEXT_PUBLIC_ENCRYPTION_KEY as string)
    : "thisisaSecretkey";

/* ---------------- Hook ---------------- */
export default function useSecureQuery(opts: Options = {}) {
  const {
    allowList = [],
    secret = DEFAULT_SECRET,
    mode = "perParam",
    bundleKey = "q",
    encryptionMode = "all",
    notFoundPath = "/404",
  } = opts;

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  /* ---------- xor helpers ---------- */
  const encrypt = useCallback(
    (value: string) => xorEncrypt(value, secret),
    [secret]
  );
  const decrypt = useCallback(
    (value: string) => xorDecrypt(value, secret, notFoundPath),
    [secret, notFoundPath]
  );

  /* ---------- memo: query ---------- */
  const { data: query } = useMemo(() => {
    if (!mounted) return { data: {} };

    const out: Record<string, string> = {};

    const safeDecrypt = (val: string): string | null => {
      try {
        return decrypt(val);
      } catch {
        return null;
      }
    };

    searchParams.forEach((value, key) => {
      if (value === "") return; // skip empties immediately

      if (mode === "single" && key === bundleKey) {
        const decoded = safeDecrypt(value);

        if (!decoded) return;

        try {
          const obj = JSON.parse(decoded);

          Object.entries(obj).forEach(([k, v]) => {
            if (v !== "") out[k] = v as string;
          });
        } catch {
          return;
        }

        return;
      }

      if (mode === "perParam") {
        const shouldEncrypt =
          encryptionMode === "all" ||
          (encryptionMode === "pure" && allowList.includes(key)) ||
          (encryptionMode === "encrypt" && !allowList.includes(key));

        if (shouldEncrypt) {
          const dec = safeDecrypt(value);

          if (dec !== null && dec !== "") out[key] = dec;
        } else {
          out[key] = value;
        }
      }
    });

    return { data: out } as const;
  }, [
    searchParams,
    allowList,
    decrypt,
    mode,
    bundleKey,
    encryptionMode,
    mounted,
  ]);

  /* ---------- builders ---------- */
  const buildSearch = useCallback(
    (params: Record<string, string | number | boolean | null | undefined>) => {
      if (mode === "single") {
        const plain = new URLSearchParams();
        const bundle: Record<string, string> = {};

        for (const [k, vRaw] of Object.entries(params)) {
          if (vRaw === undefined || vRaw === null || vRaw === "") continue;
          const v = String(vRaw);

          if (allowList.includes(k)) plain.set(k, v);
          else bundle[k] = v;
        }

        if (Object.keys(bundle).length) {
          const packed = encrypt(JSON.stringify(bundle));

          plain.set(bundleKey, packed);
        }

        const qs = plain.toString();

        return qs ? `?${qs}` : "";
      }

      // per‑param mode
      const usp = new URLSearchParams();

      for (const [k, vRaw] of Object.entries(params)) {
        if (vRaw === undefined || vRaw === null || vRaw === "") continue;
        const v = String(vRaw);

        const shouldEncrypt =
          encryptionMode === "all" ||
          (encryptionMode === "pure" && allowList.includes(k)) ||
          (encryptionMode === "encrypt" && !allowList.includes(k));

        usp.set(k, shouldEncrypt ? encrypt(v) : v);
      }

      const qs = usp.toString();

      return qs ? `?${qs}` : "";
    },
    [encrypt, allowList, mode, bundleKey, encryptionMode]
  );

  const pushEncrypted = useCallback(
    (
      path: string,
      params: Record<string, string | number | boolean | null | undefined>
    ) => router.push(`${path}${buildSearch(params)}`),
    [router, buildSearch]
  );

  const replaceEncrypted = useCallback(
    (
      path: string,
      params: Record<string, string | number | boolean | null | undefined>
    ) => router.replace(`${path}${buildSearch(params)}`),
    [router, buildSearch]
  );

  /* ---------- return ---------- */
  return {
    query,
    encrypt,
    decrypt,
    pushEncrypted,
    replaceEncrypted,
    pathname,
  } as const;
}

/* ------------------------------------------------------------------
 * Ultra‑fast XOR‑Base64 implementation (≈150 B min‑gz)
 * ------------------------------------------------------------------ */
export function xorEncrypt(text: string, key: string): string {
  const t = toUtf8(text);
  const k = toUtf8(key ?? DEFAULT_SECRET);
  const out = t.map((b, i) => b ^ k[i % k.length]);

  return base64UrlEncode(out);
}

export function xorDecrypt(
  encoded: string,
  key: string,
  notFoundPath?: string
): string | null {
  const bytes = base64UrlDecode(encoded);

  if (!bytes) {
    if (notFoundPath && typeof window !== "undefined") {
      window.location.href = notFoundPath;
    }
    return null;
  }

  const k = toUtf8(key ?? DEFAULT_SECRET);
  const out = bytes.map((b, i) => b ^ k[i % k.length]);

  return fromUtf8(out);
}

const te = new TextEncoder();
const td = new TextDecoder();

const toUtf8 = (s: string) => te.encode(s);
const fromUtf8 = (u8: Uint8Array) => td.decode(u8);

function base64UrlEncode(u8: Uint8Array): string {
  return btoa(String.fromCharCode.apply(null, Array.from(u8)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(str: string): Uint8Array | null {
  try {
    const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4;
    const padded = pad ? b64 + "=".repeat(4 - pad) : b64;
    const bin = atob(padded);
    return new Uint8Array(bin.split("").map((c) => c.charCodeAt(0)));
  } catch {
    return null;
  }
}
