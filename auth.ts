declare global {
  type D1Database = {
    prepare: (query: string) => any;
    exec: (query: string) => any;
  };
}

export {};
