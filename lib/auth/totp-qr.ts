import QRCode from "qrcode";

export async function totpQrSvg(otpauthUrl: string): Promise<string> {
  return QRCode.toString(otpauthUrl, {
    type: "svg",
    margin: 1,
    width: 180,
    color: {
      dark: "#0B0E14",
      light: "#FFFFFF",
    },
  });
}
