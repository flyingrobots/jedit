/** Layout-independent facts observed by the workspace application. */
export interface FooterSurfaceFacts {
  readonly label: string;
  readonly emphasis?: string;
  readonly detailEmphasized?: boolean;
  readonly identity: string;
  readonly identityIsPath?: boolean;
  readonly detail: string;
  readonly active: boolean;
}
