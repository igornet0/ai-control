// Type declarations for DataCode module

export interface DataCodeModule {
  execute: (code: string) => any;
  validate: (code: string) => boolean;
  parse: (code: string) => any;
}

declare const dataCode: DataCodeModule;
export default dataCode;
