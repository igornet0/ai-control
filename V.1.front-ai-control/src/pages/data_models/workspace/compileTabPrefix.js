/**
 * In-editor compile sends code from tab 0 through the active tab (inclusive),
 * in current tab order — not the full model.
 */
export function collectCompilePrefixTabs(tabs = [], activeTabIndex = 0) {
  if (!tabs.length) return [];
  const end = Math.min(Math.max(Number(activeTabIndex) || 0, 0), tabs.length - 1);
  return tabs.slice(0, end + 1);
}

export function joinTabContentsForCompile(tabs = []) {
  const codeParts = [];
  tabs.forEach((tab, index) => {
    const content = typeof tab?.content === 'string' ? tab.content : '';
    if (!content.trim()) return;
    if (tabs.length > 1) codeParts.push(`# ===== ${tab.name || `Вкладка ${index + 1}`} =====`);
    codeParts.push(content);
    if (index < tabs.length - 1) codeParts.push('');
  });
  return codeParts.join('\n');
}
