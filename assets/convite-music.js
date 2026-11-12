(() => {
  "use strict";

  const audio = document.querySelector("#rsvpThemeAudio");
  const player = document.querySelector("#rsvpMusic");
  const button = document.querySelector("#rsvpMusicButton");
  const label = document.querySelector("#rsvpMusicLabel");
  const stateKey = "ben-invite-audio";
  const themeVolume = 0.085;
  const arrivedFromInvite = new URLSearchParams(location.search).get("music") === "1";
  let state = null;
  let blocked = false;
  let explicitlyPaused = false;
  let attempting = false;
  let wasPlayingBeforeHidden = false;

  try {
    state = JSON.parse(sessionStorage.getItem(stateKey) || "null");
  } catch {
    state = null;
  }

  const freshState = state && Number.isFinite(state.savedAt) && Date.now() - state.savedAt < 30 * 60 * 1000;
  const savedShouldPlay = freshState ? state.shouldPlay !== false : true;
  explicitlyPaused = freshState && savedShouldPlay === false && !arrivedFromInvite;

  audio.loop = true;
  audio.volume = freshState && Number.isFinite(state.volume)
    ? Math.min(state.volume, themeVolume)
    : themeVolume;
  player.hidden = true;

  const saveState = () => {
    try {
      sessionStorage.setItem(stateKey, JSON.stringify({
        currentTime: Number.isFinite(audio.currentTime) ? audio.currentTime : 0,
        shouldPlay: !audio.paused && !explicitlyPaused,
        volume: audio.volume,
        savedAt: Date.now(),
      }));
    } catch {
      // O controle continua funcionando sem armazenamento.
    }
  };

  const updateControl = (mode) => {
    const playing = !audio.paused;
    player.hidden = mode === "hidden";
    player.classList.toggle("needs-tap", mode === "blocked");
    button.setAttribute("aria-pressed", String(!playing));
    button.setAttribute("aria-label", playing ? "Pausar música" : "Continuar música");
    label.textContent = playing
      ? "Música tocando"
      : mode === "blocked"
        ? "Continuar música"
        : "Música pausada";
  };

  const continueAudio = async () => {
    if (attempting) return;
    attempting = true;
    try {
      await audio.play();
      blocked = false;
      updateControl("hidden");
    } catch {
      blocked = true;
      updateControl("blocked");
    } finally {
      attempting = false;
    }
  };

  const applySavedTime = () => {
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
    const savedTime = freshState && Number.isFinite(state.currentTime) ? state.currentTime : 0;
    const travelTime = freshState && savedShouldPlay
      ? Math.max(0, (Date.now() - state.savedAt) / 1000)
      : 0;
    const target = savedTime + travelTime;
    audio.currentTime = Math.min(target, Math.max(0, audio.duration - .25));
  };

  if (audio.readyState >= 1) applySavedTime();
  else audio.addEventListener("loadedmetadata", applySavedTime, { once: true });

  if (!explicitlyPaused || arrivedFromInvite) {
    // Tenta retomar sozinho. Se o navegador bloquear, o botão discreto aparece
    // e qualquer toque na página também tenta iniciar a música.
    continueAudio();
  } else {
    updateControl("paused");
  }

  audio.addEventListener("canplay", () => {
    if (!explicitlyPaused && audio.paused) continueAudio();
  }, { once: true });

  const resumeOnGesture = () => {
    if (!explicitlyPaused && audio.paused) continueAudio();
  };
  document.addEventListener("pointerdown", resumeOnGesture, { once: true, passive: true });
  document.addEventListener("keydown", resumeOnGesture, { once: true });

  button.addEventListener("click", async () => {
    if (audio.paused) {
      explicitlyPaused = false;
      await continueAudio();
    } else {
      explicitlyPaused = true;
      audio.pause();
      updateControl("paused");
    }
    saveState();
  });

  audio.addEventListener("pause", () => {
    if (audio.ended) return;
    updateControl(blocked ? "blocked" : "paused");
  });

  audio.addEventListener("ended", () => {
    if (!explicitlyPaused) {
      audio.currentTime = 0;
      continueAudio();
    }
    saveState();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      wasPlayingBeforeHidden = !audio.paused && !explicitlyPaused;
      audio.pause();
      return;
    }
    if (wasPlayingBeforeHidden && !explicitlyPaused) continueAudio();
    wasPlayingBeforeHidden = false;
  });

  window.addEventListener("pagehide", saveState);
})();
