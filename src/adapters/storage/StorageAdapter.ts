export interface StorageAdapter {
  read(path: string): Promise<string>
  write(path: string, content: string): Promise<void>
  delete(path: string): Promise<void>
  list(dir: string): Promise<string[]>
  exists(path: string): Promise<boolean>
}
