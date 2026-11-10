import { Component as GalleryLayout } from "./gallery-layout.js";
import { contactEndpoint } from "./contact-config.js";
import { manualPlacements, manualOrder } from "./layout-adjustments.js";

const get = (id) => document.getElementById(id);
const engine = new GalleryLayout();
const pages = ["gallery", "about", "contact"];
const navLinks = document.querySelectorAll("nav a");
const layoutRoot = get("gallery-layout");
const dialog = get("artwork-dialog");
const modalImage = get("artwork-image");
const contactArt = get("contact-art");
const status = get("gallery-status");
let currentPage;
let currentWidth;
let currentMode;
let openArtwork;
let artworkOrder = [];
let galleryArtworks;
let fiveColumnReference;
let contactPool = [];

function imagePath(art) {
  return `images/${String(art.id).padStart(3, "0")}.jpg`;
}

function card(art, kind, eager) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `art-card ${kind}`;
  button.dataset.artwork = art.id;

  const mount = document.createElement("span");
  mount.className = "mount";
  const image = new Image(art.pixelWidth, art.pixelHeight);
  image.src = imagePath(art);
  image.alt = "";
  image.loading = eager ? "eager" : "lazy";
  image.decoding = "async";
  mount.append(image);

  const caption = document.createElement("span");
  caption.className = "caption";
  caption.textContent = art.displayTitle;
  button.append(mount, caption);
  button.addEventListener("click", () => showArtwork(art));
  return button;
}

function desktopGallery(columns) {
  const container = document.createElement("div");
  container.className = columns.length === 5 ? "gallery-columns wide" : "gallery-columns";
  columns.forEach((artworks, index) => {
    const column = document.createElement("div");
    column.className = "gallery-column";
    column.style.gridColumn = index * 2 + 1;
    const kind = index === Math.floor(columns.length / 2) ? "hero" : "";
    column.append(...artworks.map((art, index) => card(art, kind, index === 0)));
    container.append(column);
  });
  return container;
}

function mobileGallery({ rows }) {
  const container = document.createElement("div");
  container.className = "gallery-rows";
  for (const { items, kind, slots, gap } of rows) {
    const row = document.createElement("div");
    row.className = "gallery-row";
    row.style.setProperty("--count", slots);
    row.style.setProperty("--gap", gap);
    const eager = container.childElementCount < 2;
    row.append(...items.map((art) => card(art, kind, eager)));
    container.append(row);
  }
  return container;
}

function renderGallery() {
  const width = document.documentElement.clientWidth;
  const mode = width >= 1080 ? "wide" : width >= 860 ? "medium" : "mobile";
  document.documentElement.dataset.layout = mode;
  if (!galleryArtworks) return;
  if (currentWidth === width) return;
  if (currentMode === mode) {
    currentWidth = width;
    return;
  }
  currentWidth = width;
  currentMode = mode;
  const previousFocus = document.activeElement.dataset.artwork;
  const fiveColumns = fiveColumnReference;
  const layout = mode === "wide" ? fiveColumns
    : mode === "medium" ? engine.applyManualPlacements(engine.compute3ColumnLayout(galleryArtworks, 1100, fiveColumns), [], manualOrder)
      : engine.computeMobileLayout(galleryArtworks, fiveColumns, manualOrder);
  layoutRoot.replaceChildren(mode === "mobile" ? mobileGallery(layout) : desktopGallery(layout));
  if (previousFocus) {
    layoutRoot.querySelector(`[data-artwork="${previousFocus}"]`)?.focus({ preventScroll: true });
  }
}

function colorInfo(hex) {
  const rgb = hex.slice(1).match(/../g).map((channel) => Number.parseInt(channel, 16) / 255);
  const [r, g, b] = rgb;
  const max = Math.max(...rgb);
  const min = Math.min(...rgb);
  const chroma = max - min;
  let hue = 0;
  if (chroma) {
    if (max === r) hue = ((g - b) / chroma) % 6;
    else if (max === g) hue = (b - r) / chroma + 2;
    else hue = (r - g) / chroma + 4;
    hue = (hue * 60 + 360) % 360;
  }
  return { hue: hue > 340 ? 0 : hue, lightness: (max + min) / 2, chroma };
}

function renderPalette() {
  const groups = { sand: [], earth: [], red: [], orange: [], yellow: [], green: [], sky: [], blue: [] };
  for (const art of artworkOrder) {
    const { hue, lightness, chroma } = colorInfo(art.tone);
    let group;
    if (hue < 20) group = "red";
    else if (hue < 60) group = chroma >= .45 ? (hue < 42 ? "orange" : "yellow") : (hue >= 40 ? "sand" : "earth");
    else if (hue < 160) group = "green";
    else if (hue < 202) group = "sky";
    else group = "blue";
    groups[group].push({ art, lightness });
  }

  const entries = Object.values(groups);
  entries.forEach((group, index) => {
    const direction = index % 2 === 0 ? 1 : -1;
    group.sort((a, b) => direction * (a.lightness - b.lightness));
  });
  const brightYellows = groups.yellow.filter((item) => item.lightness >= .4);
  groups.yellow = groups.yellow.filter((item) => item.lightness < .4);
  groups.sand.splice(Math.max(0, groups.sand.length - 1), 0, ...brightYellows);

  const buttons = Object.values(groups).flat().map(({ art }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.title = art.displayTitle;
    button.setAttribute("aria-label", art.displayTitle);
    button.style.setProperty("--tone", art.tone);
    button.addEventListener("click", () => showArtwork(art));
    return button;
  });
  get("palette-bars").replaceChildren(...buttons);
}

function lightboxWidth(art) {
  const width = art.inchWidth || 20;
  const longest = Math.max(width, art.inchHeight || 20);
  let scale = 80;
  if (longest <= 8) scale = 34;
  else if (width <= 12) scale = 44;
  else if (longest <= 18) scale = 54;
  else if (longest <= 24) scale = 66;
  const ratio = art.aspectRatio;
  return `min(${(scale * Math.min(1, ratio)).toFixed(1)}vh, calc((100vh - 230px) * ${ratio}))`;
}

function showArtwork(art) {
  openArtwork = art;
  get("artwork-title").textContent = art.displayTitle;
  const details = [art.year, art.medium].filter(Boolean).join(" · ");
  const size = get("artwork-size");
  get("artwork-details").textContent = details;
  size.textContent = art.sizeInches ? `${details ? "· " : ""}${art.sizeInches} in` : "";
  size.hidden = !art.sizeInches;
  modalImage.src = imagePath(art);
  modalImage.alt = art.displayTitle;
  modalImage.style.setProperty("--artwork-width", lightboxWidth(art));
  if (!dialog.open) {
    dialog.showModal();
    document.body.classList.add("lightbox-open");
  }
  dialog.scrollTop = 0;
}

function stepArtwork(direction) {
  if (!openArtwork) return;
  const index = artworkOrder.indexOf(openArtwork);
  showArtwork(artworkOrder[(index + direction + artworkOrder.length) % artworkOrder.length]);
}

dialog.querySelector(".previous-artwork").addEventListener("click", () => stepArtwork(-1));
dialog.querySelector(".next-artwork").addEventListener("click", () => stepArtwork(1));
dialog.querySelector(".close-lightbox").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});
dialog.addEventListener("close", () => {
  document.body.classList.remove("lightbox-open");
  openArtwork = null;
});
dialog.addEventListener("keydown", (event) => {
  if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
  event.preventDefault();
  stepArtwork(event.key === "ArrowRight" ? 1 : -1);
});

function chooseContactArtwork() {
  const art = contactPool[Math.floor(Math.random() * contactPool.length)];
  if (!art) return;
  const image = contactArt.querySelector("img");
  image.src = imagePath(art);
  image.alt = art.displayTitle;
  contactArt.onclick = () => showArtwork(art);
  contactArt.hidden = false;
}

function showPage() {
  const route = location.hash.slice(1).toLowerCase();
  const page = pages.includes(route) ? route : "gallery";
  if (page === currentPage) return;
  currentPage = page;
  if (dialog.open) dialog.close();
  for (const item of pages) get(item).hidden = item !== page;
  for (const link of navLinks) {
    if (link.hash === `#${page}`) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  get("palette").hidden = page !== "gallery";
  get("header-rule").hidden = page === "gallery";
  if (page === "contact") chooseContactArtwork();
  document.title = page === "gallery" ? "Yup Art | Yuliya Popkova" : `${page === "about" ? "About" : "Contact"} | Yup Art`;
  window.scrollTo(0, 0);
}

function setupContact() {
  const endpoint = contactEndpoint.trim();
  if (!endpoint) return;
  const form = get("contact-form");
  const submit = form.querySelector('button[type="submit"]');
  const error = get("form-error");
  const success = get("contact-success");
  form.action = endpoint;
  form.querySelector("fieldset").disabled = false;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (submit.disabled) return;
    submit.disabled = true;
    error.hidden = true;
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: new FormData(form),
      });
      if (!response.ok) throw new Error("Contact submission failed");
      form.reset();
      form.hidden = true;
      success.hidden = false;
      success.focus();
    } catch {
      error.hidden = false;
    } finally {
      submit.disabled = false;
    }
  });
}

async function loadGallery() {
  try {
    const response = await fetch("./artworks.json");
    if (!response.ok) throw new Error("Catalogue could not be loaded");
    const records = await response.json();
    const arts = engine.resolveArtworkData(records.map((art) => ({
      ...art,
      displayTitle: art.title,
    })));
    artworkOrder = [...arts].sort((a, b) => engine.compareChronoDesc(a, b));
    galleryArtworks = arts;
    const automatic = engine.compute5ColumnLayout(arts, 1600);
    const adjusted = engine.applyManualPlacements(automatic, manualPlacements, manualOrder);
    fiveColumnReference = engine.balanceFiveColumnLayout(adjusted, manualPlacements, manualOrder);
    contactPool = artworkOrder.filter((art) => art.inchWidth === art.inchHeight && art.inchWidth >= 20);
    renderPalette();
    renderGallery();
    if (currentPage === "contact") chooseContactArtwork();
    status.hidden = true;
  } catch (error) {
    status.textContent = "The gallery couldn’t load. Please refresh to try again.";
    console.error(error);
  }
}

window.addEventListener("hashchange", showPage);
window.addEventListener("resize", renderGallery);
new ResizeObserver(renderGallery).observe(document.documentElement);
showPage();
setupContact();
renderGallery();
loadGallery();
