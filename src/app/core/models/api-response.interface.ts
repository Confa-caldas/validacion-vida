export interface ApiResponse<T = any> {
  body: string | T;
  statusCode: number;
  headers?: Record<string, string>;
}

export interface ApiError {
  message: string;
  statusCode: number;
  timestamp: string;
} 