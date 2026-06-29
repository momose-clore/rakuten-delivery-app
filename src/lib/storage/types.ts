export interface SaveResult {
  url: string;
  storagePath: string;
}

export interface StorageProvider {
  save(buffer: Buffer, filename: string): Promise<SaveResult>;
  read(url: string): Promise<Buffer>;
  delete(storagePath: string): Promise<void>;
}
