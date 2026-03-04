export interface UploadImageSignatureInput {
  timestamp: number;
  folder: string;
  public_id: string;
  resource_type: string;
  upload_preset?: string;
}
