/* ORBOMIX — browser-only creative editor.
   No external libraries, accounts, subscriptions or API keys are used.
   Editing controls affect the live preview; project export saves settings, not rendered MP4 media. */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const state = {
    mode: null,
    assets: [],
    selectedId: null,
    nextId: 1,
    activeTab: "media",
    filter: "none",
    effect: "none",
    text: "",
    layout: "layout-1",
    keyframes: [],
    photoDuration: 5,
    toastTimer: null
  };

  const FILTERS = {
    none: "",
    cinema: "contrast(1.14) saturate(.82) sepia(.12)",
    vivid: "contrast(1.12) saturate(1.32)",
    mono: "grayscale(1) contrast(1.08)",
    dream: "brightness(1.05) saturate(.82) sepia(.08) blur(.15px)",
    warm: "sepia(.2) saturate(1.1)"
  };

  const EFFECT_NAMES = {
    "l-shake": "L Shake", "w-shake": "W Shake", "soft-shake": "Soft Shake",
    "fast-shake": "Fast Shake", "hard-shake": "Hard Shake", flow: "Flow",
    "fade-in": "Fade in", "fade-out": "Fade out", "tv-old": "Old TV"
  };

  const MODE_INFO = {
    video: { title: "VIDEO WORKSPACE", label: "Edit your video with motion, colour and text.", accept: "video/*", upload: "Add your video", hint: "Choose video files from your device.", preview: "Your video, in a new universe.", footer: "VIDEO EDITOR · LOCAL PREVIEW" },
    photo: { title: "PHOTO WORKSPACE", label: "Give your photo a whole new atmosphere.", accept: "image/*", upload: "Add your photo", hint: "Choose image files from your device.", preview: "Give your photo a new universe.", footer: "PHOTO EDITOR · LOCAL PREVIEW" },
    collage: { title: "COLLAGE WORKSPACE", label: "Bring your favourite pictures together.", accept: "image/*", upload: "Add collage photos", hint: "Choose 2–9 images for your collage.", preview: "Your memories, in one frame.", footer: "COLLAGE STUDIO · LOCAL PREVIEW" }
  };

  const homeScreen = $("homeScreen");
  const editorScreen = $("editorScreen");
  const mediaInput = $("mediaInput");
  const replaceInput = $("replaceInput");
  const video = $("videoPreview");
  const image = $("imagePreview");
  const mediaMotion = $("mediaMotion");
  const collagePreview = $("collagePreview");
  const stageEmpty = $("stageEmpty");
  const textOverlay = $("textOverlay");
  const tvOverlay = $("tvOverlay");
  const stage = $("stage");

  function toast(message) {
    const element = $("toast");
    element.textContent = message;
    element.classList.add("show");
    window.clearTimeout(state.toastTimer);
    state.toastTimer = window.setTimeout(() => element.classList.remove("show"), 2600);
  }

  function formatTime(value) {
    const seconds = Math.max(0, Math.floor(Number(value) || 0));
    const minutes = Math.floor(seconds / 60);
    return String(minutes).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0");
  }

  function formatSize(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return "File";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function safeFilename(name) {
    return (name || "orbomix-project").replace(/[^a-z0-9-_]+/gi, "_").replace(/^_+|_+$/g, "") || "orbomix-project";
  }

  function selectedAsset() {
    return state.assets.find((asset) => asset.id === state.selectedId) || null;
  }

  function modeAssetType() {
    return state.mode === "video" ? "video" : "image";
  }

  function resetMediaElement() {
    video.pause();
    video.removeAttribute("src");
    video.dataset.assetId = "";
    video.load();
    image.removeAttribute("src");
    video.classList.remove("visible");
    image.classList.remove("visible");
    collagePreview.innerHTML = "";
    collagePreview.classList.add("is-hidden");
    mediaMotion.classList.add("is-hidden");
    stageEmpty.classList.remove("is-hidden");
    tvOverlay.classList.add("is-hidden");
    mediaMotion.style.transform = "translate(0px, 0px) rotate(0deg) scale(1)";
    mediaMotion.style.filter = "none";
    updateTransport();
  }

  function clearProjectData() {
    video.pause();
    state.assets.forEach((asset) => {
      if (asset.url) URL.revokeObjectURL(asset.url);
    });
    state.assets = [];
    state.selectedId = null;
    state.filter = "none";
    state.effect = "none";
    state.text = "";
    state.keyframes = [];
    state.nextId = 1;
    state.layout = "layout-1";
    state.photoDuration = 5;
    resetMediaElement();
    resetControls();
    renderLibrary();
    renderTimeline();
    updateInspector();
    updatePreviewTitle();
  }

  function resetControls() {
    const defaults = {
      brightness: 100, contrast: 100, saturation: 100, gamma: 100, sharpness: 0, temperature: 0,
      textOpacity: 100, textSize: 36, textX: 50, textY: 50,
      transformX: 0, transformY: 0, transformScale: 100, transformRotate: 0,
      collageGap: 8, collageRadius: 12, photoDurationRange: 5
    };
    Object.entries(defaults).forEach(([id, value]) => { if ($(id)) $(id).value = value; });
    $("overlayText").value = "";
    $("fontFamily").value = "Arial, sans-serif";
    $("textColor").value = "#ffffff";
    $("trimStart").value = 0;
    $("trimEnd").value = 0;
    $("speedSelect").value = "1";
    video.playbackRate = 1;
    state.keyframes = [];
    applyAdjustments();
    applyText();
    applyEffect("none");
    setLayout("layout-1", false);
    updateRangeOutputs();
    renderKeyframes();
  }

  function openWorkspace(mode) {
    if (!MODE_INFO[mode]) return;
    if (state.mode && state.mode !== mode && state.assets.length) {
      const confirmed = window.confirm("Start a new " + mode + " project? The current media list will be cleared.");
      if (!confirmed) return;
      clearProjectData();
    } else if (state.mode !== mode) {
      clearProjectData();
    }

    state.mode = mode;
    const info = MODE_INFO[mode];
    homeScreen.classList.add("is-hidden");
    editorScreen.classList.remove("is-hidden");
    $("workspaceLabel").textContent = info.title;
    $("uploadTitle").textContent = info.upload;
    $("uploadHint").textContent = info.hint;
    $("previewTitle").textContent = info.preview;
    $("footerMode").textContent = info.footer;
    $("projectName").value = mode === "video" ? "My Video Project" : mode === "photo" ? "My Photo Project" : "My Collage";
    mediaInput.accept = info.accept;
    $("replaceInput").accept = info.accept;
    $("mediaCount").textContent = "0";
    document.querySelectorAll(".collage-only").forEach((button) => button.classList.toggle("is-hidden", mode !== "collage"));
    document.querySelectorAll(".layout-choice").forEach((button) => button.classList.toggle("selected", button.dataset.layout === state.layout));
    showTab("media");
    updatePreviewTitle();
    updateInspector();
    updateTransport();
  }

  function goHome() {
    homeScreen.classList.remove("is-hidden");
    editorScreen.classList.add("is-hidden");
    closeExportModal();
  }

  function startNewProject() {
    if (state.assets.length && !window.confirm("Start a new project? Your current media list and unsaved settings will be cleared.")) return;
    clearProjectData();
    state.mode = null;
    goHome();
    toast("Choose a new creative workspace.");
  }

  function showTab(tab) {
    if (tab === "layouts" && state.mode !== "collage") return;
    state.activeTab = tab;
    document.querySelectorAll(".tool-tab").forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
    document.querySelectorAll(".tool-panel").forEach((panel) => panel.classList.toggle("active", panel.id === "panel-" + tab));
  }

  function addFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const expected = modeAssetType();
    const valid = files.filter((file) => file.type.startsWith(expected + "/"));
    const rejected = files.length - valid.length;
    if (rejected) toast(state.mode === "video" ? "Video workspace accepts video files only." : "This workspace accepts image files only.");
    if (!valid.length) return;

    const available = state.mode === "collage" ? Math.max(0, 9 - state.assets.length) : valid.length;
    const acceptedFiles = valid.slice(0, available);
    if (state.mode === "collage" && valid.length > acceptedFiles.length) toast("A collage can contain up to 9 photos.");

    acceptedFiles.forEach((file) => {
      const asset = {
        id: state.nextId++,
        name: file.name,
        type: expected,
        file,
        url: URL.createObjectURL(file),
        size: file.size,
        duration: expected === "image" ? 5 : 0,
        width: 0,
        height: 0,
        trimStart: 0,
        trimEnd: 0,
        photoDuration: 5
      };
      state.assets.push(asset);
      if (expected === "image") {
        const probe = new Image();
        probe.onload = () => {
          asset.width = probe.naturalWidth;
          asset.height = probe.naturalHeight;
          if (selectedAsset()?.id === asset.id) updateInspector();
          renderTimeline();
        };
        probe.src = asset.url;
      }
    });

    if (acceptedFiles.length) {
      state.selectedId = state.assets[state.assets.length - 1].id;
      if (state.mode === "video") showTab("media");
      renderLibrary();
      renderPreview();
      renderTimeline();
      updateInspector();
      updateTransport();
      updatePreviewTitle();
      toast(acceptedFiles.length === 1 ? "Media added to your workspace." : acceptedFiles.length + " files added to your workspace.");
    }
  }

  function selectAsset(id) {
    const asset = state.assets.find((item) => item.id === Number(id));
    if (!asset) return;
    state.selectedId = asset.id;
    renderLibrary();
    renderPreview();
    renderTimeline();
    updateInspector();
    updateTransport();
  }

  function renderLibrary() {
    const container = $("mediaLibrary");
    container.innerHTML = "";
    $("mediaCount").textContent = String(state.assets.length);
    if (!state.assets.length) {
      const empty = document.createElement("div");
      empty.className = "library-empty";
      empty.textContent = "Your imported files will appear here.";
      container.appendChild(empty);
      return;
    }
    state.assets.forEach((asset) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "media-item" + (asset.id === state.selectedId ? " selected" : "");
      button.dataset.id = String(asset.id);
      if (state.mode === "collage") {
        button.draggable = true;
        button.addEventListener("dragstart", (event) => {
          event.dataTransfer.setData("text/plain", String(asset.id));
          event.dataTransfer.effectAllowed = "move";
        });
        button.addEventListener("dragover", (event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; });
        button.addEventListener("drop", (event) => {
          event.preventDefault();
          const draggedId = Number(event.dataTransfer.getData("text/plain"));
          const from = state.assets.findIndex((item) => item.id === draggedId);
          const to = state.assets.findIndex((item) => item.id === asset.id);
          if (from < 0 || to < 0 || from === to) return;
          const [moved] = state.assets.splice(from, 1);
          state.assets.splice(to, 0, moved);
          renderLibrary(); renderCollage(); renderTimeline();
          toast("Collage photo order updated.");
        });
      }
      const thumb = document.createElement("span");
      thumb.className = "media-thumb";
      if (asset.type === "image") {
        const thumbImage = document.createElement("img");
        thumbImage.src = asset.url;
        thumbImage.alt = "";
        thumb.appendChild(thumbImage);
      } else {
        thumb.textContent = "▶";
      }
      const info = document.createElement("span");
      info.className = "media-info";
      const name = document.createElement("b");
      name.textContent = asset.name;
      const meta = document.createElement("small");
      meta.textContent = asset.type.toUpperCase() + " · " + formatSize(asset.size);
      info.append(name, meta);
      const check = document.createElement("span");
      check.className = "media-check";
      check.textContent = asset.id === state.selectedId ? "●" : "";
      button.append(thumb, info, check);
      button.addEventListener("click", () => selectAsset(asset.id));
      container.appendChild(button);
    });
  }

  function renderPreview() {
    const asset = selectedAsset();
    video.pause();
    video.classList.remove("visible");
    image.classList.remove("visible");
    collagePreview.classList.add("is-hidden");
    collagePreview.innerHTML = "";
    stageEmpty.classList.toggle("is-hidden", Boolean(asset) || (state.mode === "collage" && state.assets.length > 0));
    mediaMotion.classList.toggle("is-hidden", !asset && !(state.mode === "collage" && state.assets.length));
    video.style.filter = "none";
    image.style.filter = "none";

    if (!asset) {
      resetMediaElement();
      updateTransport();
      return;
    }

    if (state.mode === "video" && asset.type === "video") {
      if (video.dataset.assetId !== String(asset.id)) {
        video.dataset.assetId = String(asset.id);
        video.src = asset.url;
        video.load();
      }
      video.classList.add("visible");
      video.playbackRate = Number($("speedSelect").value) || 1;
      stageEmpty.classList.add("is-hidden");
      image.removeAttribute("src");
    } else if (state.mode === "photo") {
      image.src = asset.url;
      image.classList.add("visible");
      stageEmpty.classList.add("is-hidden");
      video.removeAttribute("src");
      video.dataset.assetId = "";
    } else if (state.mode === "collage") {
      renderCollage();
      stageEmpty.classList.add("is-hidden");
      video.removeAttribute("src");
      video.dataset.assetId = "";
    }

    applyAdjustments();
    applyText();
    applyEffect(state.effect, false);
    updateMotion(state.mode === "video" ? video.currentTime || 0 : 0);
    updateInspector();
    updateTransport();
  }

  function renderCollage() {
    collagePreview.classList.remove("is-hidden");
    collagePreview.className = "collage-preview " + state.layout;
    collagePreview.style.gap = $("collageGap").value + "px";
    collagePreview.style.padding = $("collageGap").value + "px";
    collagePreview.style.setProperty("--collage-radius", $("collageRadius").value + "px");
    const assets = state.assets.filter((item) => item.type === "image").slice(0, 9);
    assets.forEach((asset) => {
      const cell = document.createElement("div");
      cell.className = "collage-cell";
      const pic = document.createElement("img");
      pic.src = asset.url;
      pic.alt = asset.name;
      cell.appendChild(pic);
      cell.title = asset.name;
      cell.addEventListener("click", () => selectAsset(asset.id));
      collagePreview.appendChild(cell);
    });
    if (assets.length === 1) {
      const cell = collagePreview.firstElementChild;
      cell.style.gridColumn = "1 / -1";
      cell.style.gridRow = "1 / -1";
    }
    applyAdjustments();
  }

  function getFilterStyle() {
    const brightness = Number($("brightness").value);
    const contrast = Number($("contrast").value);
    const saturation = Number($("saturation").value);
    const gamma = Number($("gamma").value);
    const sharpness = Number($("sharpness").value);
    const temperature = Number($("temperature").value);
    // CSS has no direct gamma or sharpening control; these are gentle visual approximations.
    const gammaBrightness = 100 * (100 / Math.max(50, gamma));
    const sharpnessContrast = 1 + sharpness / 420;
    const temperatureFilter = temperature > 0 ? `sepia(${temperature / 170})` : `hue-rotate(${Math.abs(temperature) * 0.22}deg)`;
    const base = `brightness(${(brightness * gammaBrightness / 100).toFixed(3)}%) contrast(${(contrast * sharpnessContrast / 100).toFixed(3)}) saturate(${saturation}%) ${temperatureFilter}`;
    const preset = FILTERS[state.filter] || "";
    return base + (preset ? " " + preset : "");
  }

  function applyAdjustments() {
    const filter = getFilterStyle();
    video.style.filter = filter;
    image.style.filter = filter;
    collagePreview.querySelectorAll("img").forEach((img) => { img.style.filter = filter; });
    updateRangeOutputs();
    document.querySelectorAll(".filter-chip").forEach((button) => button.classList.toggle("active", button.dataset.filter === state.filter));
  }

  function updateRangeOutputs() {
    const mappings = {
      brightness: (v) => v + "%", contrast: (v) => v + "%", saturation: (v) => v + "%",
      gamma: (v) => (Number(v) / 100).toFixed(2), sharpness: (v) => v, temperature: (v) => (Number(v) > 0 ? "+" : "") + v,
      textOpacity: (v) => v + "%", textSize: (v) => v + "px", textX: (v) => v + "%", textY: (v) => v + "%",
      transformX: (v) => v + "px", transformY: (v) => v + "px", transformScale: (v) => v + "%", transformRotate: (v) => v + "°",
      collageGap: (v) => v + "px", collageRadius: (v) => v + "px", photoDurationRange: (v) => Number(v).toFixed(1) + " sec"
    };
    Object.entries(mappings).forEach(([id, formatter]) => {
      const output = $(id === "photoDurationRange" ? "photoDurationOut" : id + "Out");
      if (output && $(id)) output.textContent = formatter($(id).value);
    });
  }

  function applyText() {
    state.text = $("overlayText").value;
    const content = state.text.trim();
    textOverlay.textContent = content;
    textOverlay.classList.toggle("visible", Boolean(content));
    textOverlay.style.color = $("textColor").value;
    textOverlay.style.fontFamily = $("fontFamily").value;
    textOverlay.style.fontSize = $("textSize").value + "px";
    textOverlay.style.opacity = String(Number($("textOpacity").value) / 100);
    textOverlay.style.left = $("textX").value + "%";
    textOverlay.style.top = $("textY").value + "%";
    textOverlay.style.transform = "translate(-50%, -50%)";
    updateRangeOutputs();
    renderTimeline();
  }

  function applyEffect(effect, notify = true) {
    const allowed = ["none", ...Object.keys(EFFECT_NAMES)];
    if (!allowed.includes(effect)) effect = "none";
    state.effect = effect;
    const oldClasses = Array.from(mediaMotion.classList).filter((name) => name.startsWith("effect-"));
    oldClasses.forEach((name) => mediaMotion.classList.remove(name));
    if (effect !== "none" && effect !== "tv-old") mediaMotion.classList.add("effect-" + effect);
    tvOverlay.classList.toggle("is-hidden", effect !== "tv-old");
    document.querySelectorAll("[data-effect]").forEach((button) => button.classList.toggle("active", button.dataset.effect === effect));
    $("activeEffectNote").innerHTML = "Current effect: <strong>" + (effect === "none" ? "None" : EFFECT_NAMES[effect]) + "</strong>";
    if (notify) toast(effect === "none" ? "Effect removed." : EFFECT_NAMES[effect] + " applied to preview.");
  }

  function setLayout(layout, notify = true) {
    if (!/^layout-[1-9]$/.test(layout)) return;
    state.layout = layout;
    document.querySelectorAll(".layout-choice").forEach((button) => button.classList.toggle("selected", button.dataset.layout === layout));
    if (state.mode === "collage" && state.assets.length) renderCollage();
    if (notify) toast("Collage layout updated.");
  }

  function updateInspector() {
    const asset = selectedAsset();
    const details = $("selectedDetails");
    const title = $("trimControls").querySelector(".inspector-section-title");
    const hint = $("trimControls").querySelector(".hint-text");
    const isVideo = state.mode === "video" && asset && asset.type === "video";
    const isPhoto = state.mode === "photo" && asset && asset.type === "image";
    if (!asset) {
      details.innerHTML = "<div class=\"detail-icon\">◈</div><b>Nothing selected</b><small>Import a file to view its properties.</small>";
    } else {
      const duration = isVideo ? (asset.duration || video.duration || 0) : (asset.photoDuration || 5);
      const dimensions = asset.width && asset.height ? asset.width + " × " + asset.height : "Dimensions loading";
      const summary = asset.type === "video" ? formatTime(duration) : dimensions;
      details.innerHTML = "";
      const icon = document.createElement("div"); icon.className = "detail-icon"; icon.textContent = asset.type === "video" ? "▶" : "▧";
      const name = document.createElement("b"); name.textContent = asset.name;
      const meta = document.createElement("small"); meta.textContent = asset.type.toUpperCase() + " · " + summary + " · " + formatSize(asset.size);
      details.append(icon, name, meta);
    }

    if (isVideo) {
      $("photoDurationControl").classList.add("is-hidden");
      title.innerHTML = "<span>✂</span> TRIM VIDEO";
      hint.textContent = "Preview playback stops at the chosen end point.";
      $("trimStart").disabled = false;
      $("trimEnd").disabled = false;
      $("trimStart").value = Number(asset.trimStart || 0).toFixed(1);
      $("trimEnd").value = Number(asset.trimEnd || asset.duration || video.duration || 0).toFixed(1);
      $("applyTrimBtn").disabled = false;
    } else if (isPhoto) {
      title.innerHTML = "<span>◷</span> PHOTO DURATION";
      hint.textContent = "A photo starts at 0 seconds. Set how long it stays in your sequence.";
      $("trimStart").value = "0";
      $("trimStart").disabled = true;
      $("trimEnd").disabled = false;
      $("trimEnd").value = Number(asset.photoDuration || 5).toFixed(1);
      $("photoDurationControl").classList.remove("is-hidden");
      $("photoDurationRange").value = Math.max(.5, Math.min(30, Number(asset.photoDuration || 5)));
      $("applyTrimBtn").disabled = false;
    } else {
      $("photoDurationControl").classList.add("is-hidden");
      title.innerHTML = "<span>✂</span> CLIP TIMING";
      hint.textContent = state.mode === "collage" ? "Select a picture in the collage to see its details." : "Select a media item to edit its timing.";
      $("trimStart").value = "0";
      $("trimEnd").value = state.mode === "collage" ? "0" : "5";
      $("trimStart").disabled = true;
      $("trimEnd").disabled = true;
      $("applyTrimBtn").disabled = true;
    }
    $("speedSelect").disabled = !isVideo;
    $("replaceMediaBtn").disabled = !asset;
    $("removeMediaBtn").disabled = !asset;
  }

  function updateTransport() {
    const asset = selectedAsset();
    const videoMode = state.mode === "video" && asset && asset.type === "video";
    const imageMode = state.mode === "photo" && asset && asset.type === "image";
    if (videoMode) {
      const duration = Number.isFinite(video.duration) ? video.duration : (asset.duration || 0);
      const current = Number.isFinite(video.currentTime) ? video.currentTime : 0;
      $("timeReadout").textContent = formatTime(current) + " / " + formatTime(duration);
      $("seekBar").max = Math.max(duration, .1);
      $("seekBar").value = Math.min(current, duration || 0);
      $("seekBar").disabled = !duration;
      $("playBtn").disabled = false;
      $("playBtn").textContent = video.paused ? "▶" : "Ⅱ";
      $("playBtn").setAttribute("aria-label", video.paused ? "Play" : "Pause");
      $("zoomReadout").textContent = "VIDEO";
      $("timelineDuration").textContent = formatTime(duration);
    } else if (imageMode) {
      const duration = asset.photoDuration || 5;
      $("timeReadout").textContent = "00:00 / " + formatTime(duration);
      $("seekBar").max = duration;
      $("seekBar").value = 0;
      $("seekBar").disabled = true;
      $("playBtn").disabled = true;
      $("playBtn").textContent = "▶";
      $("playBtn").setAttribute("aria-label", "Video playback is not available for a photo");
      $("zoomReadout").textContent = "PHOTO";
      $("timelineDuration").textContent = formatTime(duration);
    } else {
      $("timeReadout").textContent = "00:00 / 00:00";
      $("seekBar").max = 100;
      $("seekBar").value = 0;
      $("seekBar").disabled = true;
      $("playBtn").disabled = true;
      $("playBtn").textContent = "▶";
      $("playBtn").setAttribute("aria-label", "Select a video to play");
      $("zoomReadout").textContent = state.mode === "collage" ? "COLLAGE" : "PREVIEW";
      $("timelineDuration").textContent = state.mode === "collage" ? String(state.assets.length) + " PHOTOS" : "00:00";
    }
  }

  function updatePreviewTitle() {
    const asset = selectedAsset();
    const title = $("previewTitle");
    const info = $("previewMeta");
    if (!state.mode) return;
    if (asset) {
      title.textContent = asset.name;
      info.textContent = state.mode === "video" ? "VIDEO · LIVE PREVIEW" : state.mode === "photo" ? "PHOTO · LIVE PREVIEW" : state.assets.length + " PHOTOS · COLLAGE";
    } else {
      title.textContent = MODE_INFO[state.mode].preview;
      info.textContent = state.mode.toUpperCase() + " · PREVIEW";
    }
  }

  function renderTimeline() {
    const mediaTrack = $("mediaTrack");
    mediaTrack.innerHTML = "";
    if (!state.assets.length) {
      mediaTrack.innerHTML = "<span class=\"track-placeholder\">Your clips appear here</span>";
    } else {
      state.assets.forEach((asset) => {
        const clip = document.createElement("button");
        clip.type = "button";
        clip.className = "timeline-clip" + (asset.type === "image" ? " image" : "") + (asset.id === state.selectedId ? " selected" : "");
        clip.textContent = asset.name;
        clip.title = "Select " + asset.name;
        clip.addEventListener("click", () => selectAsset(asset.id));
        mediaTrack.appendChild(clip);
      });
    }

    const textTrack = $("textTrack");
    textTrack.innerHTML = "";
    if (state.text.trim()) {
      const textClip = document.createElement("span");
      textClip.className = "timeline-clip";
      textClip.textContent = "Text: " + state.text.trim().slice(0, 22);
      textTrack.appendChild(textClip);
    } else {
      textTrack.innerHTML = "<span class=\"track-placeholder\">Text overlay</span>";
    }

    const keyframeTrack = $("keyframeTrack");
    keyframeTrack.innerHTML = "";
    if (state.keyframes.length) {
      const duration = Math.max(1, selectedAsset()?.duration || video.duration || 1);
      state.keyframes.forEach((keyframe) => {
        const marker = document.createElement("span");
        marker.className = "keyframe-marker";
        marker.style.marginLeft = Math.max(3, Math.min(65, (keyframe.time / duration) * 100)) + "%";
        marker.title = "Keyframe at " + formatTime(keyframe.time);
        keyframeTrack.appendChild(marker);
      });
    } else {
      keyframeTrack.innerHTML = "<span class=\"track-placeholder\">Motion points</span>";
    }
  }

  function currentTransform() {
    return {
      x: Number($("transformX").value),
      y: Number($("transformY").value),
      scale: Number($("transformScale").value),
      rotate: Number($("transformRotate").value)
    };
  }

  function updateMotion(time) {
    const frames = state.keyframes.slice().sort((a, b) => a.time - b.time);
    if (!frames.length) {
      const initial = currentTransform();
      mediaMotion.style.transform = `translate(${initial.x}px, ${initial.y}px) rotate(${initial.rotate}deg) scale(${initial.scale / 100})`;
      updateRangeOutputs();
      return;
    }
    let before = frames[0];
    let after = frames[frames.length - 1];
    if (time <= frames[0].time) after = before;
    else if (time >= frames[frames.length - 1].time) before = after;
    else {
      for (let index = 0; index < frames.length - 1; index += 1) {
        if (time >= frames[index].time && time <= frames[index + 1].time) {
          before = frames[index];
          after = frames[index + 1];
          break;
        }
      }
    }
    const span = after.time - before.time;
    const progress = span <= 0 ? 0 : Math.min(1, Math.max(0, (time - before.time) / span));
    const lerp = (key) => before[key] + (after[key] - before[key]) * progress;
    const x = lerp("x");
    const y = lerp("y");
    const scale = lerp("scale");
    const rotate = lerp("rotate");
    mediaMotion.style.transform = `translate(${x}px, ${y}px) rotate(${rotate}deg) scale(${scale / 100})`;
  }

  function addKeyframe() {
    if (!selectedAsset()) {
      toast("Import and select media before adding a keyframe.");
      return;
    }
    const time = state.mode === "video" ? (Number(video.currentTime) || 0) : 0;
    const transform = currentTransform();
    const existing = state.keyframes.find((frame) => Math.abs(frame.time - time) < 0.06);
    if (existing) Object.assign(existing, transform);
    else state.keyframes.push({ time, ...transform });
    state.keyframes.sort((a, b) => a.time - b.time);
    renderKeyframes();
    renderTimeline();
    updateMotion(time);
    toast("Keyframe added at " + formatTime(time) + ".");
  }

  function renderKeyframes() {
    const container = $("keyframeList");
    container.innerHTML = "";
    if (!state.keyframes.length) {
      const empty = document.createElement("div");
      empty.className = "library-empty";
      empty.textContent = "No keyframes yet.";
      container.appendChild(empty);
      return;
    }
    state.keyframes.forEach((frame, index) => {
      const row = document.createElement("div");
      row.className = "keyframe-item";
      const label = document.createElement("b"); label.textContent = "◇ Keyframe " + (index + 1);
      const time = document.createElement("small"); time.textContent = formatTime(frame.time);
      const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "×"; remove.title = "Remove keyframe";
      remove.addEventListener("click", () => {
        state.keyframes = state.keyframes.filter((item) => item !== frame);
        renderKeyframes(); renderTimeline(); updateMotion(video.currentTime || 0);
      });
      row.append(label, time, remove);
      container.appendChild(row);
    });
  }

  function seekTo(value) {
    const asset = selectedAsset();
    if (!asset || state.mode !== "video" || asset.type !== "video" || !Number.isFinite(video.duration)) return;
    const minimum = Number(asset.trimStart || 0);
    const maximum = Number(asset.trimEnd || video.duration);
    const target = Math.min(Math.max(Number(value) || 0, minimum), maximum || video.duration);
    video.currentTime = target;
    updateTransport();
    updateMotion(target);
  }

  function applyTrim() {
    const asset = selectedAsset();
    if (!asset) return;
    if (state.mode === "photo" && asset.type === "image") {
      const seconds = Math.max(.5, Math.min(30, Number($("trimEnd").value) || 5));
      asset.photoDuration = seconds;
      $("trimEnd").value = seconds.toFixed(1);
      $("photoDurationRange").value = seconds;
      updateInspector(); updateTransport(); renderTimeline();
      toast("Photo duration set to " + seconds.toFixed(1) + " seconds.");
      return;
    }
    if (state.mode !== "video" || asset.type !== "video") return;
    const duration = Number.isFinite(video.duration) ? video.duration : (asset.duration || 0);
    let start = Math.max(0, Math.min(Number($("trimStart").value) || 0, duration));
    let end = Math.max(0, Math.min(Number($("trimEnd").value) || duration, duration));
    if (end <= start) {
      end = Math.min(duration, start + .1);
      if (end <= start) start = Math.max(0, end - .1);
    }
    asset.trimStart = start;
    asset.trimEnd = end;
    $("trimStart").value = start.toFixed(1);
    $("trimEnd").value = end.toFixed(1);
    video.pause();
    video.currentTime = start;
    updateInspector();
    updateTransport();
    toast("Trim range applied to the preview.");
  }

  function removeSelectedMedia() {
    const asset = selectedAsset();
    if (!asset) { toast("Select a media item first."); return; }
    const wasVideo = asset.id === state.selectedId && video.dataset.assetId === String(asset.id);
    if (wasVideo) {
      video.pause();
      video.removeAttribute("src");
      video.load();
      video.dataset.assetId = "";
    }
    URL.revokeObjectURL(asset.url);
    state.assets = state.assets.filter((item) => item.id !== asset.id);
    state.keyframes = [];
    state.selectedId = state.assets.length ? state.assets[state.assets.length - 1].id : null;
    if (state.mode === "collage" && state.assets.length === 0) resetMediaElement();
    renderLibrary(); renderPreview(); renderTimeline(); updateInspector(); updateTransport(); updatePreviewTitle();
    toast("Selected media removed.");
  }

  function replaceSelectedFile(file) {
    const asset = selectedAsset();
    if (!asset || !file) return;
    const expected = modeAssetType();
    if (!file.type.startsWith(expected + "/")) {
      toast(state.mode === "video" ? "Choose a video file to replace this clip." : "Choose an image file to replace this picture.");
      return;
    }
    const oldUrl = asset.url;
    if (state.mode === "video") {
      video.pause();
      video.removeAttribute("src");
      video.dataset.assetId = "";
      video.load();
    }
    asset.file = file;
    asset.name = file.name;
    asset.size = file.size;
    asset.url = URL.createObjectURL(file);
    asset.duration = expected === "image" ? 5 : 0;
    asset.width = 0; asset.height = 0; asset.trimStart = 0; asset.trimEnd = 0; asset.photoDuration = 5;
    URL.revokeObjectURL(oldUrl);
    if (expected === "image") {
      const probe = new Image();
      probe.onload = () => { asset.width = probe.naturalWidth; asset.height = probe.naturalHeight; updateInspector(); };
      probe.src = asset.url;
    }
    renderLibrary(); renderPreview(); renderTimeline(); updateInspector(); updateTransport(); updatePreviewTitle();
    toast("Media replaced successfully.");
  }

  function openExportModal() {
    const asset = selectedAsset();
    const description = state.mode === "video"
      ? "Save your timeline, trim points, text, effects and adjustment settings as an ORBOMIX project file."
      : state.mode === "photo"
        ? "Save your photo editing settings as a project file, or download the selected original photo."
        : "Save your collage layout and editing settings as a project file, or download a selected original photo.";
    $("exportDescription").textContent = description;
    $("downloadOriginalBtn").disabled = !asset;
    $("downloadOriginalBtn").textContent = state.mode === "video" ? "Download selected original video" : "Download selected original photo";
    $("exportModal").classList.remove("is-hidden");
  }

  function closeExportModal() {
    $("exportModal").classList.add("is-hidden");
  }

  function saveProjectFile() {
    const data = {
      app: "ORBOMIX",
      version: 2,
      mode: state.mode,
      projectName: $("projectName").value.trim() || "Untitled ORBOMIX Project",
      savedAt: new Date().toISOString(),
      media: state.assets.map((asset) => ({
        name: asset.name, type: asset.type, size: asset.size, duration: asset.duration,
        photoDuration: asset.photoDuration, trimStart: asset.trimStart, trimEnd: asset.trimEnd,
        width: asset.width, height: asset.height
      })),
      selectedMedia: selectedAsset()?.name || null,
      adjustments: Object.fromEntries(["brightness", "contrast", "saturation", "gamma", "sharpness", "temperature"].map((id) => [id, $(id).value])),
      filter: state.filter,
      effect: state.effect,
      text: {
        content: state.text, font: $("fontFamily").value, color: $("textColor").value,
        size: $("textSize").value, opacity: $("textOpacity").value, x: $("textX").value, y: $("textY").value
      },
      keyframes: state.keyframes,
      collage: { layout: state.layout, gap: $("collageGap").value, radius: $("collageRadius").value },
      speed: $("speedSelect").value
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = safeFilename(data.projectName) + ".orbomix.json";
    document.body.appendChild(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1200);
    closeExportModal();
    toast("Project settings downloaded. Keep your original media files too.");
  }

  function downloadOriginal() {
    const asset = selectedAsset();
    if (!asset) { toast("Select a media item first."); return; }
    const link = document.createElement("a");
    link.href = asset.url;
    link.download = asset.name;
    document.body.appendChild(link); link.click(); link.remove();
    closeExportModal();
    toast("Original media download started. Preview edits are not baked into it.");
  }

  function updateVideoMetadata() {
    const asset = selectedAsset();
    if (!asset || state.mode !== "video" || asset.type !== "video") return;
    if (Number.isFinite(video.duration)) {
      asset.duration = video.duration;
      if (!asset.trimEnd || asset.trimEnd > video.duration) asset.trimEnd = video.duration;
      if (Number($("trimEnd").value) === 0) $("trimEnd").value = video.duration.toFixed(1);
      updateInspector();
      updateTransport();
      renderTimeline();
    }
  }

  function initializeEvents() {
    document.querySelectorAll(".launch-card").forEach((button) => {
      button.addEventListener("click", () => openWorkspace(button.dataset.mode));
    });
    document.querySelectorAll(".tool-tab").forEach((button) => {
      button.addEventListener("click", () => showTab(button.dataset.tab));
    });

    $("homeBtn").addEventListener("click", goHome);
    $("newProjectBtn").addEventListener("click", startNewProject);
    $("chooseMediaBtn").addEventListener("click", () => { mediaInput.accept = MODE_INFO[state.mode].accept; mediaInput.click(); });
    $("addMoreBtn").addEventListener("click", () => { mediaInput.accept = MODE_INFO[state.mode].accept; mediaInput.click(); });
    $("clearMediaBtn").addEventListener("click", () => {
      if (!state.assets.length) return;
      if (!window.confirm("Clear all imported media from this project?")) return;
      state.assets.forEach((asset) => URL.revokeObjectURL(asset.url));
      state.assets = []; state.selectedId = null; state.keyframes = [];
      resetMediaElement(); renderLibrary(); renderTimeline(); renderKeyframes(); updateInspector(); updateTransport(); updatePreviewTitle();
      toast("Media library cleared.");
    });
    mediaInput.addEventListener("change", (event) => {
      addFiles(event.target.files);
      mediaInput.value = "";
    });
    $("replaceMediaBtn").addEventListener("click", () => {
      const asset = selectedAsset();
      if (!asset) return;
      replaceInput.accept = MODE_INFO[state.mode].accept;
      replaceInput.click();
    });
    replaceInput.addEventListener("change", (event) => {
      if (event.target.files && event.target.files[0]) replaceSelectedFile(event.target.files[0]);
      replaceInput.value = "";
    });
    $("removeMediaBtn").addEventListener("click", removeSelectedMedia);

    $("playBtn").addEventListener("click", async () => {
      const asset = selectedAsset();
      if (!asset || state.mode !== "video" || asset.type !== "video") {
        toast("Select a video to use playback controls.");
        return;
      }
      if (!video.paused) {
        video.pause();
        return;
      }
      const duration = Number.isFinite(video.duration) ? video.duration : (asset.duration || 0);
      const start = Number(asset.trimStart || 0);
      const end = Number(asset.trimEnd || duration);
      if (video.currentTime < start || (end > 0 && video.currentTime >= end)) video.currentTime = start;
      try {
        await video.play();
      } catch (error) {
        toast("This video could not play in your browser. Try another video format.");
      }
      updateTransport();
    });
    $("backBtn").addEventListener("click", () => seekTo(video.currentTime - 5));
    $("forwardBtn").addEventListener("click", () => seekTo(video.currentTime + 5));
    $("seekBar").addEventListener("input", (event) => seekTo(event.target.value));
    video.addEventListener("loadedmetadata", updateVideoMetadata);
    video.addEventListener("timeupdate", () => {
      const asset = selectedAsset();
      if (asset && state.mode === "video") {
        const end = Number(asset.trimEnd || video.duration);
        if (end && video.currentTime >= end) {
          video.pause();
          video.currentTime = end;
        }
      }
      updateTransport();
      updateMotion(video.currentTime || 0);
    });
    ["play", "pause", "ended", "waiting", "canplay"].forEach((eventName) => video.addEventListener(eventName, updateTransport));
    $("applyTrimBtn").addEventListener("click", applyTrim);
    $("photoDurationRange").addEventListener("input", () => {
      const seconds = Number($("photoDurationRange").value);
      $("trimEnd").value = seconds.toFixed(1);
      const asset = selectedAsset();
      if (asset && state.mode === "photo") asset.photoDuration = seconds;
      updateRangeOutputs(); updateTransport(); renderTimeline();
    });
    $("trimEnd").addEventListener("input", () => {
      const asset = selectedAsset();
      if (asset && state.mode === "photo") {
        const seconds = Math.max(.5, Math.min(30, Number($("trimEnd").value) || 5));
        $("photoDurationRange").value = seconds;
        asset.photoDuration = seconds;
        updateRangeOutputs(); updateTransport(); renderTimeline();
      }
    });
    $("speedSelect").addEventListener("change", () => {
      video.playbackRate = Number($("speedSelect").value) || 1;
      toast("Preview speed changed to " + video.playbackRate + "×.");
    });

    ["brightness", "contrast", "saturation", "gamma", "sharpness", "temperature"].forEach((id) => {
      $(id).addEventListener("input", applyAdjustments);
    });
    document.querySelectorAll(".filter-chip").forEach((button) => {
      button.addEventListener("click", () => {
        state.filter = button.dataset.filter;
        applyAdjustments();
        toast((button.dataset.filter === "none" ? "Original filter" : button.textContent.trim() + " filter") + " selected.");
      });
    });
    $("resetAdjustBtn").addEventListener("click", () => {
      $("brightness").value = 100; $("contrast").value = 100; $("saturation").value = 100;
      $("gamma").value = 100; $("sharpness").value = 0; $("temperature").value = 0;
      state.filter = "none"; applyAdjustments(); toast("Adjustments reset.");
    });

    document.querySelectorAll("[data-effect]").forEach((button) => {
      button.addEventListener("click", () => applyEffect(button.dataset.effect));
    });
    $("clearEffectBtn").addEventListener("click", () => applyEffect("none"));

    ["overlayText", "fontFamily", "textColor", "textSize", "textOpacity", "textX", "textY"].forEach((id) => {
      $(id).addEventListener(id === "overlayText" || id === "textSize" ? "input" : "input", applyText);
    });
    $("applyTextBtn").addEventListener("click", () => { applyText(); toast("Text updated on the preview."); });
    $("clearTextBtn").addEventListener("click", () => {
      $("overlayText").value = ""; applyText(); toast("Text removed.");
    });

    ["transformX", "transformY", "transformScale", "transformRotate"].forEach((id) => {
      $(id).addEventListener("input", () => { updateRangeOutputs(); updateMotion(state.mode === "video" ? video.currentTime || 0 : 0); });
    });
    $("addKeyframeBtn").addEventListener("click", addKeyframe);
    $("clearKeyframesBtn").addEventListener("click", () => {
      state.keyframes = []; renderKeyframes(); renderTimeline(); updateMotion(video.currentTime || 0); toast("Keyframes cleared.");
    });

    document.querySelectorAll(".layout-choice").forEach((button) => {
      button.addEventListener("click", () => setLayout(button.dataset.layout));
    });
    ["collageGap", "collageRadius"].forEach((id) => {
      $(id).addEventListener("input", () => {
        updateRangeOutputs();
        if (state.mode === "collage") renderCollage();
      });
    });

    $("exportBtn").addEventListener("click", openExportModal);
    $("closeExportBtn").addEventListener("click", closeExportModal);
    $("exportModal").addEventListener("click", (event) => { if (event.target === $("exportModal")) closeExportModal(); });
    $("saveProjectFileBtn").addEventListener("click", saveProjectFile);
    $("downloadOriginalBtn").addEventListener("click", downloadOriginal);
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeExportModal(); });

    window.addEventListener("beforeunload", () => {
      state.assets.forEach((asset) => { if (asset.url) URL.revokeObjectURL(asset.url); });
    });
  }

  initializeEvents();
  resetControls();
  updateTransport();
})();
// ORBOMIX PWA Registration
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./service-worker.js")
      .then((registration) => {
        console.log("ORBOMIX PWA registered:", registration.scope);
      })
      .catch((error) => {
        console.error("PWA registration failed:", error);
      });
  });
}