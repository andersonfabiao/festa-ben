(() => {
  "use strict";

  const audio = document.querySelector("#rsvpThemeAudio");
  const player = document.querySelector("#rsvpMusic");
  const button = document.querySelector("#rsvpMusicButton");
  const label = document.querySelector("#rsvpMusicLabel");
  const stateKey = "ben-invite-audio";
  const arrivedFromInvite = new URLSearchParams(location.search).get("music") === "1";
  let state = null;

  try {
    state = JSON.parse(sessionStorage.getItem(stateKey) || "null");
  } catch {
    state = null;
  }

  const freshState = state && Number.isFinite(state.savedAt) && Date.now() - state.savedAt < 30 * 60 * 1000;
  player.hidden = false;

  const saveState = () => {
    try {
      sessionStorage.setItem(stateKey, JSON.stringify({
        currentTime: Number.isFinite(audio.currentTime) ? audio.currentTime : 0,
        shouldPlay: !audio.paused,
        volume: audio.volume,
        savedAt: Date.now(),
      }));
    } catch {
      // O controle continua funcionando sem armazenamento.
    }
  };

  const updateControl = (blocked = false) => {
    const playing = !audio.paused;
    button.setAttribute("aria-pressed", String(!playing));
    button.setAttribute("aria-label", playing ? "Pausar música" : "Continuar música");
    label.textContent = playing ? "Música tocando" : (blocked ? "Continuar música" : "Música pausada");
    player.classList.toggle("needs-tap", blocked);
  };

  const continueAudio = async () => {
    try {
      await audio.play();
      updateControl(false);
    } catch {
      updateControl(true);
    }
  };

  const prepare = () => {
    const savedTime = freshState && Number.isFinite(state.currentTime) ? state.currentTime : 0;
    const travelTime = freshState && state.shouldPlay ? Math.max(0, (Date.now() - state.savedAt) / 1000) : 0;
    const target = savedTime + travelTime;
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      audio.currentTime = Math.min(target, Math.max(0, audio.duration - .25));
    }
    audio.volume = freshState && Number.isFinite(state.volume) ? state.volume : .62;

    const explicitlyPaused = freshState && state.shouldPlay === false;
    if (!explicitlyPaused || arrivedFromInvite) {
      continueAudio();
    } else {
      updateControl(false);
    }
  };

  if (audio.readyState >= 1) prepare();
  else audio.addEventListener("loadedmetadata", prepare, { once: true });

  button.addEventListener("click", async () => {
    if (audio.paused) await continueAudio();
    else {
      audio.pause();
      updateControl(false);
    }
    saveState();
  });

  audio.addEventListener("ended", () => {
    audio.currentTime = 0;
    updateControl(false);
    saveState();
  });
  window.addEventListener("pagehide", saveState);
})();
