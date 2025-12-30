interface BarcodeDetectorOptions {
  formats?: string[];
}

interface BarcodeDetectorResult {
  rawValue: string;
  format: string;
  boundingBox?: DOMRectReadOnly;
  cornerPoints?: DOMPointReadOnly[];
}

declare class BarcodeDetector {
  constructor(options?: BarcodeDetectorOptions);
  detect(image: ImageBitmapSource): Promise<BarcodeDetectorResult[]>;
  static getSupportedFormats(): Promise<string[]>;
}
