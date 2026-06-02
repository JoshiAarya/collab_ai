/**
 * Simple client-side router utilities
 */

export function getInviteCodeFromUrl() {
  const path = window.location.pathname;
  const match = path.match(/\/join\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

export function getDiscussionInviteFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('discussion');
}

export function clearUrl() {
  window.history.replaceState({}, document.title, '/');
}

export function navigateTo(path) {
  window.history.pushState({}, document.title, path);
}
