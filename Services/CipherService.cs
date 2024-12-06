using System;
using System.Text;
using System.Security.Cryptography;

public class CipherService
{
  private const int W = 32;
  private const int R = 12;
  private const int B = 16;
  private const int C = 4;
  private const uint P32 = 0xB7E15163;
  private const uint Q32 = 0x9E3779B9;
  private uint[] S;

  public string GenerateKey()
  {
    byte[] key = new byte[B];
    RandomNumberGenerator.Fill(key);
    return Convert.ToBase64String(key);
  }

  private byte[] NormalizeKey(string key)
  {
    byte[] keyBytes = Encoding.UTF8.GetBytes(key);

    byte[] normalizedKey = new byte[B];

    if (keyBytes.Length >= B)
    {
      Array.Copy(keyBytes, normalizedKey, B);
    }
    else
    {
      for (int i = 0; i < B; i++)
      {
        normalizedKey[i] = keyBytes[i % keyBytes.Length];
      }
    }

    return normalizedKey;
  }

  private string PrepareKey(string key)
  {
    byte[] normalizedKey = NormalizeKey(key);
    return Convert.ToBase64String(normalizedKey);
  }
  
  private void KeyExpansion(byte[] key)
  {
    S = new uint[2 * (R + 1)];
    uint[] L = new uint[C];

    for (int i = 0; i < B; i++)
    {
      L[i / 4] = (L[i / 4] << 8) + key[i];
    }

    S[0] = P32;
    for (int i = 1; i < 2 * (R + 1); i++)
    {
      S[i] = S[i - 1] + Q32;
    }

    uint A = 0, B_local = 0;
    int i1 = 0, j = 0;
    int v = 3 * Math.Max(2 * (R + 1), C);

    for (int s = 1; s <= v; s++)
    {
      A = S[i1] = ROL(S[i1] + A + B_local, 3);
      B_local = L[j] = ROL(L[j] + A + B_local, (int)(A + B_local));
      i1 = (i1 + 1) % (2 * (R + 1));
      j = (j + 1) % C;
    }
  }

  public string Encrypt(string text, string key)
  {
    string base64Key = PrepareKey(key);
    byte[] keyBytes = Convert.FromBase64String(base64Key);
    KeyExpansion(keyBytes);

    byte[] textBytes = Encoding.UTF8.GetBytes(text);
    uint[] blocks = ConvertToBlocks(textBytes);

    for (int i = 0; i < blocks.Length; i += 2)
    {
      uint A = blocks[i];
      uint B = blocks[i + 1];

      A = A + S[0];
      B = B + S[1];

      for (int j = 1; j <= R; j++)
      {
        A = ROL(A ^ B, (int)B) + S[2 * j];
        B = ROL(B ^ A, (int)A) + S[2 * j + 1];
      }

      blocks[i] = A;
      blocks[i + 1] = B;
    }

    return Convert.ToBase64String(ConvertToBytes(blocks));
  }

  public string Decrypt(string text, string key)
  {
    string base64Key = PrepareKey(key);
    byte[] keyBytes = Convert.FromBase64String(base64Key);
    KeyExpansion(keyBytes);

    byte[] textBytes = Convert.FromBase64String(text);
    uint[] blocks = ConvertToBlocks(textBytes);

    for (int i = 0; i < blocks.Length; i += 2)
    {
      uint A = blocks[i];
      uint B = blocks[i + 1];

      for (int j = R; j >= 1; j--)
      {
        B = ROR(B - S[2 * j + 1], (int)A) ^ A;
        A = ROR(A - S[2 * j], (int)B) ^ B;
      }

      B = B - S[1];
      A = A - S[0];

      blocks[i] = A;
      blocks[i + 1] = B;
    }

    return Encoding.UTF8.GetString(ConvertToBytes(blocks));
  }

  private uint ROL(uint value, int shift)
  {
    shift %= 32;
    return (value << shift) | (value >> (32 - shift));
  }

  private uint ROR(uint value, int shift)
  {
    shift %= 32;
    return (value >> shift) | (value << (32 - shift));
  }

  private uint[] ConvertToBlocks(byte[] data)
  {
    int blockCount = (data.Length + 7) / 8 * 2;
    uint[] blocks = new uint[blockCount];

    for (int i = 0; i < data.Length; i += 4)
    {
      uint block = 0;
      for (int j = 0; j < 4 && i + j < data.Length; j++)
      {
        block |= (uint)(data[i + j] << (j * 8));
      }
      blocks[i / 4] = block;
    }

    return blocks;
  }

  private byte[] ConvertToBytes(uint[] blocks)
  {
    byte[] result = new byte[blocks.Length * 4];

    for (int i = 0; i < blocks.Length; i++)
    {
      uint block = blocks[i];
      for (int j = 0; j < 4; j++)
      {
        result[i * 4 + j] = (byte)(block >> (j * 8));
      }
    }

    return result;
  }
}