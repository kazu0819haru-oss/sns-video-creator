// アプリで使用可能なフォント一覧。
// family: CSS font-family 文字列
// label: UI 表示名
// weight: デフォルトの font-weight
// tag: 用途バッジ
export const FONTS = [
  { id: 'shippori-mincho', family: '"Shippori Mincho B1", serif',     label: 'Shippori Mincho',     weight: 500, tag: '明朝・デフォルト' },
  { id: 'dela-gothic',     family: '"Dela Gothic One", sans-serif',    label: 'Dela Gothic One',     weight: 400, tag: 'ウルトラボールド' },
  { id: 'rampart',         family: '"Rampart One", sans-serif',        label: 'Rampart One',         weight: 400, tag: 'アウトライン' },
  { id: 'stick',           family: '"Stick", sans-serif',              label: 'Stick',               weight: 400, tag: '超細長' },
  { id: 'zen-old',         family: '"Zen Old Mincho", serif',          label: 'Zen Old Mincho',      weight: 900, tag: 'エレガント明朝' },
  { id: 'shippori-antique',family: '"Shippori Antique B1", serif',     label: 'Shippori Antique',    weight: 400, tag: 'レトロ明朝' },
  { id: 'kaisei',          family: '"Kaisei HarunoUmi", serif',        label: 'Kaisei HarunoUmi',    weight: 700, tag: 'モダン明朝' },
  { id: 'rocknroll',       family: '"RocknRoll One", sans-serif',      label: 'RocknRoll One',       weight: 400, tag: 'ポップ' },
  { id: 'bebas',           family: '"Bebas Neue", sans-serif',         label: 'Bebas Neue',          weight: 400, tag: '英字特化' },
  { id: 'klee',            family: '"Klee One", cursive',              label: 'Klee One',            weight: 600, tag: '手書き' },
  { id: 'yuji',            family: '"Yuji Syuku", serif',              label: 'Yuji Syuku',          weight: 400, tag: '毛筆' },
  { id: 'reggae',          family: '"Reggae One", sans-serif',         label: 'Reggae One',          weight: 400, tag: '個性派太字' },
  { id: 'mplus',           family: '"M PLUS 1", sans-serif',           label: 'M PLUS 1',            weight: 700, tag: '万能モダン' },
];

export function getFontById(id) {
  return FONTS.find(f => f.id === id) || FONTS[0];
}
