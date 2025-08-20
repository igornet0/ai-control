// Type declarations for grammar modules

export interface DataCodeRuntime {
  execute: (code: string) => any;
  compile: (code: string) => any;
  validate: (code: string) => boolean;
}

declare const DataCodeRuntime: DataCodeRuntime;
export { DataCodeRuntime };
