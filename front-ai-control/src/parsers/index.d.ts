// Type declarations for parser modules

export interface DataCodeParser {
  parse: (code: string) => any;
  validate: (code: string) => boolean;
  getErrors: () => string[];
}

export interface DataCodeTerms {
  [key: string]: any;
}

declare const dataCodeParser: DataCodeParser;
declare const dataCodeTerms: DataCodeTerms;

export { dataCodeParser, dataCodeTerms };
