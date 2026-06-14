/** Reload the page. Extracted so it can be stubbed in tests (jsdom's
 * `location.reload` isn't spy-able). */
export function reloadPage(): void {
  window.location.reload()
}
