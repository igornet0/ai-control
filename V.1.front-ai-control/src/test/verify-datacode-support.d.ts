// Type declarations for DataCode verification test

export interface DataCodeVerification {
  verify: () => boolean;
  getResults: () => any[];
}

declare const verifyDataCodeSupport: DataCodeVerification;
export default verifyDataCodeSupport;
