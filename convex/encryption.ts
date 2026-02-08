const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || "dev-fallback-secret-do-not-use-in-prod-123";

/**
 * Derives a 256-bit AES-GCM key from the ENCRYPTION_SECRET.
 */
async function getCryptoKey() {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        enc.encode(ENCRYPTION_SECRET),
        "PBKDF2",
        false,
        ["deriveKey"]
    );
    return await crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: enc.encode("openclaw-salt-2024"),
            iterations: 100000,
            hash: "SHA-256",
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
}

/**
 * Encrypts a string using AES-256-GCM.
 */
export async function encrypt(text: string): Promise<{ encryptedValue: string; iv: string }> {
    const key = await getCryptoKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        enc.encode(text)
    );

    const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');
    const encryptedHex = Array.from(new Uint8Array(encrypted)).map(b => b.toString(16).padStart(2, '0')).join('');

    return { encryptedValue: encryptedHex, iv: ivHex };
}

/**
 * Decrypts a hex string using AES-256-GCM.
 */
export async function decrypt(encryptedHex: string, ivHex: string): Promise<string> {
    const key = await getCryptoKey();

    const iv = new Uint8Array(ivHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    const encrypted = new Uint8Array(encryptedHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

    const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        encrypted
    );

    const dec = new TextDecoder();
    return dec.decode(decrypted);
}
