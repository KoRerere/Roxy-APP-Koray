use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use wasm_bindgen::prelude::*;

/// 密钥分片 — 32 字节拆成 4 段，运行时 XOR 重组，避免静态 hex 字符串
const FRAG_A: [u8; 8] = [0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77];
const FRAG_B: [u8; 8] = [0x88, 0x99, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff];
const FRAG_C: [u8; 8] = [0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77];
const FRAG_D: [u8; 8] = [0x88, 0x99, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff];
const MASK: [u8; 32] = [
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
];

fn assemble_static_key() -> [u8; 32] {
    let mut key = [0u8; 32];
    key[..8].copy_from_slice(&FRAG_A);
    key[8..16].copy_from_slice(&FRAG_B);
    key[16..24].copy_from_slice(&FRAG_C);
    key[24..32].copy_from_slice(&FRAG_D);
    for (i, m) in MASK.iter().enumerate() {
        key[i] ^= m;
    }
    key
}

fn derive_key(session_material: Option<&str>) -> [u8; 32] {
    let static_key = assemble_static_key();
    let Some(material) = session_material.filter(|s| !s.is_empty()) else {
        return static_key;
    };

    let mut derived = static_key;
    let bytes = material.as_bytes();
    for (i, byte) in derived.iter_mut().enumerate() {
        *byte ^= bytes[i % bytes.len()];
    }
    derived
}

fn cipher_from_key(key_bytes: &[u8; 32]) -> Aes256Gcm {
    Aes256Gcm::new_from_slice(key_bytes).expect("invalid key length")
}

fn encrypt_with_key(msg: &str, key_bytes: &[u8; 32]) -> Result<String, JsValue> {
    let cipher = cipher_from_key(key_bytes);
    let mut nonce_bytes = [0u8; 12];
    getrandom::getrandom(&mut nonce_bytes).map_err(|e| JsValue::from_str(&e.to_string()))?;
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, msg.as_bytes())
        .map_err(|e| JsValue::from_str(&format!("encrypt failed: {e}")))?;

    let tag_start = ciphertext.len().saturating_sub(16);
    let (ct, tag) = ciphertext.split_at(tag_start);

    Ok(format!(
        "{}:{}:{}",
        BASE64.encode(ct),
        BASE64.encode(nonce_bytes),
        BASE64.encode(tag)
    ))
}

fn decrypt_with_key(str: &str, key_bytes: &[u8; 32]) -> Result<String, JsValue> {
    let parts: Vec<&str> = str.split(':').collect();
    if parts.len() != 3 {
        return Err(JsValue::from_str("Invalid encrypted string format"));
    }

    let ciphertext = BASE64
        .decode(parts[0])
        .map_err(|e| JsValue::from_str(&format!("invalid ciphertext: {e}")))?;
    let nonce_bytes = BASE64
        .decode(parts[1])
        .map_err(|e| JsValue::from_str(&format!("invalid nonce: {e}")))?;
    let auth_tag = BASE64
        .decode(parts[2])
        .map_err(|e| JsValue::from_str(&format!("invalid auth tag: {e}")))?;

    if nonce_bytes.len() != 12 {
        return Err(JsValue::from_str("invalid nonce length"));
    }

    let mut merged = ciphertext;
    merged.extend_from_slice(&auth_tag);

    let cipher = cipher_from_key(key_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);
    let plaintext = cipher
        .decrypt(nonce, merged.as_ref())
        .map_err(|e| JsValue::from_str(&format!("decrypt failed: {e}")))?;

    String::from_utf8(plaintext).map_err(|e| JsValue::from_str(&format!("invalid utf-8: {e}")))
}

#[wasm_bindgen]
pub fn encrypt_aes_gcm(msg: &str) -> Result<String, JsValue> {
    let key = assemble_static_key();
    encrypt_with_key(msg, &key)
}

#[wasm_bindgen]
pub fn decrypt_aes_gcm(str: &str) -> Result<String, JsValue> {
    let key = assemble_static_key();
    decrypt_with_key(str, &key)
}

/// 本地敏感数据加密（v2）：密钥 = staticKey XOR sessionMaterial
#[wasm_bindgen]
pub fn encrypt_aes_gcm_local(msg: &str, session_material: &str) -> Result<String, JsValue> {
    let key = derive_key(Some(session_material));
    let encrypted = encrypt_with_key(msg, &key)?;
    Ok(format!("v2:{encrypted}"))
}

#[wasm_bindgen]
pub fn decrypt_aes_gcm_local(str: &str, session_material: &str) -> Result<String, JsValue> {
    let payload = str.strip_prefix("v2:").unwrap_or(str);
    let key = derive_key(Some(session_material));
    decrypt_with_key(payload, &key)
}
