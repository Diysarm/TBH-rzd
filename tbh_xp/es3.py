"""Easy Save 3 (ES3) AES decryption for TBH: Task Bar Hero save files.

Scheme (reverse-engineered from the game + the community Save Inspector):
    - File layout: [16-byte IV/salt][AES-CBC ciphertext]
    - Key:  PBKDF2-HMAC-SHA1(password, salt=IV, iterations=100, dklen=16)
    - Cipher: AES-128-CBC with PKCS7 padding
    - Plaintext: UTF-8 JSON
"""

from __future__ import annotations

import hashlib

from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

# Default ES3 password baked into TBH builds. The developer can change this in a
# game update; if decryption starts failing, update `es3Password` in config.json.
DEFAULT_PASSWORD = "emuMqG3bLYJ938ZDCfieWJ"

_IV_SIZE = 16
_PBKDF2_ITERATIONS = 100
_KEY_LEN = 16  # AES-128


class Es3Error(Exception):
    """Raised when an ES3 buffer cannot be decrypted/parsed."""


def decrypt(data: bytes, password: str = DEFAULT_PASSWORD) -> bytes:
    """Decrypt raw ES3 bytes and return the plaintext bytes."""
    if data is None or len(data) <= _IV_SIZE:
        raise Es3Error("File is too small to be an .es3 save.")

    iv = data[:_IV_SIZE]
    ciphertext = data[_IV_SIZE:]

    # Ciphertext must be a whole number of AES blocks. A partial length almost
    # always means we caught the game mid-write; treat as a transient error.
    if len(ciphertext) % 16 != 0:
        raise Es3Error("Ciphertext length is not a multiple of the AES block size "
                       "(save may be mid-write).")

    key = hashlib.pbkdf2_hmac(
        "sha1", password.encode("utf-8"), iv, _PBKDF2_ITERATIONS, dklen=_KEY_LEN
    )

    decryptor = Cipher(algorithms.AES(key), modes.CBC(iv)).decryptor()
    padded = decryptor.update(ciphertext) + decryptor.finalize()

    # Manual PKCS7 unpad so a wrong password yields a clean Es3Error rather than
    # a library-specific exception.
    if not padded:
        raise Es3Error("Decryption produced no data.")
    pad = padded[-1]
    if pad < 1 or pad > 16 or pad > len(padded):
        raise Es3Error(
            "Decryption failed: wrong password or not a TaskbarHero save. "
            "The password can change after a game update."
        )
    if padded[-pad:] != bytes([pad]) * pad:
        raise Es3Error(
            "Decryption failed: wrong password or not a TaskbarHero save. "
            "The password can change after a game update."
        )
    return padded[:-pad]


def decrypt_to_text(data: bytes, password: str = DEFAULT_PASSWORD) -> str:
    """Decrypt raw ES3 bytes and return the plaintext as UTF-8 text."""
    try:
        return decrypt(data, password).decode("utf-8")
    except UnicodeDecodeError as exc:  # pragma: no cover - defensive
        raise Es3Error(f"Decrypted data is not valid UTF-8: {exc}") from exc
