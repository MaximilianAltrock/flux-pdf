export function scrollToPageId(
  pageId: string,
  options: ScrollIntoViewOptions = { behavior: 'smooth', block: 'nearest' },
): boolean {
  const target = document.querySelector(`[data-page-id="${pageId}"]`)
  if (!(target instanceof HTMLElement)) return false
  target.scrollIntoView(options)
  return true
}
