export function scrollToPageId(pageId: string, behavior: ScrollBehavior = 'smooth'): void {
  const target = document.querySelector(`[data-page-id="${pageId}"]`)
  if (!(target instanceof HTMLElement)) return
  target.scrollIntoView({ behavior, block: 'nearest' })
}
