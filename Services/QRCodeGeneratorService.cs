using QRCoder;

public class QRCodeGeneratorService
{
  public string GenerateQRCode(string text)
  {
    var qrGenerator = new QRCoder.QRCodeGenerator();
    var qrCodeData = qrGenerator.CreateQrCode(text, QRCodeGenerator.ECCLevel.Q);
    var qrCode = new BitmapByteQRCode(qrCodeData);
    var qrCodeImage = qrCode.GetGraphic(20);
    return Convert.ToBase64String(qrCodeImage);
  }
}