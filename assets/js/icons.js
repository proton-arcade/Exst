/* Small inline icon set; no icon font or external runtime dependency. */
const iconPaths = {
  folder:
    '<path d="M3 7V5a2 2 0 0 1 2-2h5l3 3h6a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
  gamepad:
    '<path d="M6.4 6h11.2a3 3 0 0 1 2.9 2.2l1.3 7a3 3 0 0 1-5 2.7L14.5 16h-5l-2.3 1.9a3 3 0 0 1-5-2.7l1.3-7A3 3 0 0 1 6.4 6Z"/><path d="M7 9v5m-2.5-2.5h5M16 10h.01M18.5 13h.01"/>',
  compass:
    '<circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5Z"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  heart:
    '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0l-1 1-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  zap: '<path d="m13 2-9 12h7l-1 8 10-13h-7Z"/>',
  mountain: '<path d="m2 20 7-14 4 7 3-5 6 12ZM6.5 11l2.5 2 2-3"/>',
  flag: '<path d="M4 22V3m0 0c6-5 10 5 16 0v11c-6 5-10-5-16 0"/>',
  puzzle:
    '<path d="M8 3H3v5a3 3 0 1 1 0 6v7h7a3 3 0 1 1 6 0h5v-7a3 3 0 1 1 0-6V3h-7a3 3 0 1 1-6 0Z"/>',
  shuffle:
    '<path d="m18 2 4 4-4 4m0 4 4 4-4 4M2 6h3c5 0 9 12 14 12h3M2 18h3c2 0 4-2 5-4m4-4c2-2 3-4 5-4h3"/>',
  "arrow-right": '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  "arrow-up-right": '<path d="M6 18 18 6M6 6h12v12"/>',
  settings:
    '<path d="m9 3-1 3-3 1-2 4 2 2v4l4 2 3-1 3 1 4-2v-4l2-2-2-4-3-1-1-3Z"/><circle cx="12" cy="11" r="3"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  search: '<circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  star: '<path d="m12 2 3 6.5 7 1-5 5 1 7-6-3.5-6 3.5 1-7-5-5 7-1Z"/>',
  play: '<path d="m8 4 12 8-12 8Z"/>',
  trophy:
    '<path d="M7 3h10v6a5 5 0 0 1-10 0ZM7 5H3v3a4 4 0 0 0 5 4m9-7h4v3a4 4 0 0 1-5 4m-4 2v6m-5 1h10"/>',
  flame:
    '<path d="M13 2c2 7-5 6-4 12 3-1 4-3 5-5 5 4 6 6 5 9-3 7-15 4-14-3 0-5 5-8 8-13Z"/>',
  sort: '<path d="M4 5h16M4 12h11M4 19h6"/>',
  "chevron-down": '<path d="m6 9 6 6 6-6"/>',
  x: '<path d="m6 6 12 12M6 18 18 6"/>',
  volume:
    '<path d="m11 4-6 5H2v6h3l6 5ZM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  fullscreen: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
};
function icon(name, cls = "") {
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name] || iconPaths.gamepad}</svg>`;
}
function renderIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((el) => {
    el.innerHTML = icon(el.dataset.icon);
    el.removeAttribute("data-icon");
  });
}
renderIcons();
