declare module "qr.js" {
  interface QRData {
    modules: boolean[][];
  }
  function qr(value: string): QRData;
  export default qr;
}
