import { fitLine, formatGraftOutlineLine, graftOutlineScroll } from './workspace-render.js';

const GRAFT_CHANGE_ROWS = 5;

export interface GraftDrawerOutlineItem {
  readonly kind: string;
  readonly name: string;
  readonly startLine: number;
}

export interface GraftDrawerInfo {
  readonly relativePath: string;
  readonly outlineItems: readonly GraftDrawerOutlineItem[];
  readonly changeLines: readonly string[];
  readonly notice?: string;
  readonly error?: string;
}

export interface GraftDrawerState {
  readonly editor?: object;
  readonly graftInfo?: GraftDrawerInfo;
  readonly graftLoading: boolean;
  readonly graftSelectedIndex: number;
}

export function renderGraftDrawerLines(model: GraftDrawerState, width: number, height: number): readonly string[] {
  const info = model.graftInfo;
  if (model.editor == null) {
    return [
      fitLine('graft', width),
      fitLine('', width),
      fitLine('open a file to inspect it', width),
    ];
  }

  if (info == null) {
    return [
      fitLine('graft', width),
      fitLine('', width),
      fitLine(model.graftLoading ? 'loading...' : 'no graft data loaded', width),
    ];
  }

  const metaLines = [
    'graft',
    info.relativePath,
    model.graftLoading ? 'loading...' : (info.notice ?? ''),
    info.error ?? '',
    'outline',
  ];
  const changeLines = ['', 'changes', ...info.changeLines];
  const outlineHeight = Math.max(1, height - metaLines.length - Math.min(GRAFT_CHANGE_ROWS, changeLines.length));
  const outlineStart = graftOutlineScroll(model.graftSelectedIndex, info.outlineItems.length, outlineHeight);
  const outlineLines = info.outlineItems.length === 0
    ? ['no structural outline']
    : info.outlineItems
      .slice(outlineStart, outlineStart + outlineHeight)
      .map((item, index) => formatGraftOutlineLine(item, {
        selected: outlineStart + index === model.graftSelectedIndex,
      }));

  return [
    ...metaLines.map((line) => fitLine(line, width)),
    ...outlineLines.map((line) => fitLine(line, width)),
    ...changeLines.slice(0, Math.max(0, height - metaLines.length - outlineLines.length)).map((line) => fitLine(line, width)),
  ];
}
