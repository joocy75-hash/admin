export type ApiResponse<T> = {
  data: T;
  message?: string;
};

export type PaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type GameCategory =
  | 'casino'
  | 'slot'
  | 'mini_game'
  | 'virtual_soccer'
  | 'sports'
  | 'esports'
  | 'holdem';
