package com.example.electroui.data;

import java.security.MessageDigest;
import java.security.SecureRandom;
import java.security.spec.KeySpec;
import java.util.Arrays;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;

/**
 * Құпиясөзді хэштеу: PBKDF2-HMAC-SHA256 + кездейсоқ «тұз» (salt).
 * Дерекқорда құпиясөздің өзі емес, тек тұз бен хэш сақталады.
 */
public final class PasswordHasher {
    public static final String ALGORITHM = "PBKDF2WithHmacSHA256";
    public static final int ITERATIONS = 60_000;
    private static final int KEY_BITS = 256;
    private static final SecureRandom RANDOM = new SecureRandom();

    private PasswordHasher() {
    }

    /** 16 байт кездейсоқ тұз (hex түрінде). */
    public static String newSalt() {
        byte[] salt = new byte[16];
        RANDOM.nextBytes(salt);
        return toHex(salt);
    }

    public static String hash(String password, String saltHex) {
        char[] chars = password.toCharArray();
        KeySpec spec = new PBEKeySpec(chars, fromHex(saltHex), ITERATIONS, KEY_BITS);
        try {
            byte[] key = SecretKeyFactory.getInstance(ALGORITHM).generateSecret(spec).getEncoded();
            return toHex(key);
        } catch (Exception e) {
            throw new IllegalStateException("PBKDF2 қолжетімсіз", e);
        } finally {
            Arrays.fill(chars, '\0');
        }
    }

    /** Тұрақты уақытта салыстыру — уақыт бойынша шабуылдан қорғайды. */
    public static boolean verify(String password, String saltHex, String expectedHex) {
        byte[] actual = fromHex(hash(password, saltHex));
        byte[] expected = fromHex(expectedHex);
        return MessageDigest.isEqual(actual, expected);
    }

    /** Құпиясөздің беріктігі 0..4. */
    public static int strength(String p) {
        if (p == null || p.isEmpty()) return 0;
        int score = 0;
        if (p.length() >= 8) score++;
        if (p.length() >= 12) score++;
        boolean lower = false, upper = false, digit = false, other = false;
        for (char c : p.toCharArray()) {
            if (Character.isLowerCase(c)) lower = true;
            else if (Character.isUpperCase(c)) upper = true;
            else if (Character.isDigit(c)) digit = true;
            else other = true;
        }
        if ((lower || upper) && digit) score++;
        if (upper && lower || other) score++;
        return Math.min(4, score);
    }

    static String toHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) sb.append(String.format("%02x", b));
        return sb.toString();
    }

    static byte[] fromHex(String hex) {
        byte[] out = new byte[hex.length() / 2];
        for (int i = 0; i < out.length; i++)
            out[i] = (byte) Integer.parseInt(hex.substring(i * 2, i * 2 + 2), 16);
        return out;
    }
}
