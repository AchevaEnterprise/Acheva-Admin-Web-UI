export interface IAPIResponse<T> {
  status: boolean;
  statusCode: string | number;
  data: T;
  message: string;
}
