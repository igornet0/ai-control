// Type declarations for CodeMirror DataCode support

export interface DataCodeSupport {
  language: any;
  completion: any;
  highlighting: any;
}

declare const dataCodeSupport: DataCodeSupport;
export default dataCodeSupport;
