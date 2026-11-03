// 機種ごとの対応表。印刷できるのは PT-P300BT(12mm は実機で確認)と、同じ 128 ドットのヘッドの PT-P710BT(実験的)。
// support:
//   'verified'     … 実機で確認(12mm)。ほかの幅は未確認
//   'experimental' … 印刷データは送れるが、その機種では未確認
//   'preview'      … 下見のみ(通信の仕様が未確認)
export const MODELS = {
  'PT-P300BT': { tapes: [3.5, 6, 9, 12], dpi: 180, support: 'verified' },
  'PT-P320BT': { tapes: [3.5, 6, 9, 12], dpi: 180, support: 'preview' },   // テープ幅は P300BT と同じと仮定した目安
  'PT-P710BT': { tapes: [3.5, 6, 9, 12, 18, 24], dpi: 180, support: 'experimental' },
  'PT-P910BT': { tapes: [3.5, 6, 9, 12, 18, 24, 36], dpi: 360, support: 'preview' },
};
export const canPrint = (model) => MODELS[model].support !== 'preview';
