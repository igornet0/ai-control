/** Layout profile for stats widgets based on grid spans and measured size. */

export function resolveWidgetLayoutProfile({
  width = 0,
  height = 0,
  colSpan = 1,
  rowSpan = 1,
} = {}) {
  const wide = width >= 400 || colSpan >= 2;
  const tall = height >= 340 || rowSpan >= 4;
  const xLarge = height >= 480 || (rowSpan >= 5 && colSpan >= 1);
  const fullWidth = colSpan >= 3 || width >= 640;

  let progressLayout = 'stack';
  if (wide && tall) progressLayout = 'hero-side';
  else if (wide) progressLayout = 'side';
  else if (tall) progressLayout = 'stack-large';

  let barLayout = 'bars';
  if (wide && tall) barLayout = 'columns';
  else if (wide) barLayout = 'grid';
  else if (tall) barLayout = 'bars-tall';

  const donutSize = xLarge ? 208 : tall ? 176 : wide ? 152 : 128;
  const barHeight = xLarge ? 48 : tall ? 40 : 32;

  return {
    wide,
    tall,
    xLarge,
    fullWidth,
    progressLayout,
    barLayout,
    donutSize,
    barHeight,
  };
}
