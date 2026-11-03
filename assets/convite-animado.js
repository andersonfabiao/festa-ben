(() => {
  const experience = document.querySelector("#experience");
  const buzzPreludeVideo = document.querySelector("#buzzPreludeVideo");
  const buzzSoundStart = document.querySelector("#buzzSoundStart");
  const startButton = document.querySelector("#startButton");
  const soundButton = document.querySelector("#soundButton");
  const replayButton = document.querySelector("#replayButton");
  const skipButton = document.querySelector("#skipButton");
  const confirmButton = document.querySelector("#confirmButton");
  const finalInvite = document.querySelector("#finalInvite");
  const revealVideo = document.querySelector("#revealVideo");
  const audio = document.querySelector("#themeAudio");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const audioStateKey = "ben-invite-audio";

  // Quando o link vem do WhatsApp de um convidado, leva a chave para a confirmação.
  try {
    const inviteKey = new URLSearchParams(window.location.search).get("convite");
    if (inviteKey && confirmButton) {
      confirmButton.href = "convite.html?music=1&convite=" + encodeURIComponent(inviteKey);
    }
  } catch (e) {
    /* ignora */
  }
  let timers = [];
  let soundEnabled = true;
  let navigatingToRsvp = false;

  const finishPrelude = () => {
    if (experience.classList.contains("is-prelude-complete")) return;
    experience.classList.add("is-prelude-complete");
    experience.classList.remove("is-buzz-playing");
    if (buzzPreludeVideo) buzzPreludeVideo.pause();
  };

  if (reduceMotion.matches) {
    finishPrelude();
  } else if (buzzPreludeVideo && buzzSoundStart) {
    buzzPreludeVideo.addEventListener("ended", finishPrelude, { once: true });
    buzzPreludeVideo.muted = false;
    buzzPreludeVideo.volume = 0.9;
    buzzPreludeVideo.currentTime = 0;
    buzzSoundStart.addEventListener("click", async () => {
      buzzSoundStart.disabled = true;
      buzzPreludeVideo.muted = false;
      buzzPreludeVideo.volume = 0.9;
      buzzPreludeVideo.currentTime = 0;
      try {
        await buzzPreludeVideo.play();
        experience.classList.add("is-buzz-playing");
        window.setTimeout(finishPrelude, 16000);
      } catch {
        buzzSoundStart.disabled = false;
        const label = buzzSoundStart.lastElementChild;
        if (label) label.textContent = "Tentar novamente";
      }
    });
  } else {
    finishPrelude();
  }

  const clearTimers = () => {
    timers.forEach(window.clearTimeout);
    timers = [];
  };

  const later = (callback, delay) => {
    timers.push(window.setTimeout(callback, delay));
  };

  const setScene = (scene) => {
    experience.classList.remove("is-reveal", "is-reveal-leaving", "is-intro", "is-envelope", "is-final");
    experience.classList.add(`is-${scene}`);
    if (scene !== "reveal" && revealVideo) revealVideo.pause();
    if (scene === "final") finalInvite.focus({ preventScroll: true });
  };

  const updateSoundButton = () => {
    soundButton.textContent = soundEnabled ? "♫" : "♪̸";
    soundButton.setAttribute("aria-label", soundEnabled ? "Desativar som" : "Ativar som");
    soundButton.setAttribute("aria-pressed", String(!soundEnabled));
  };

  const saveAudioState = () => {
    try {
      sessionStorage.setItem(audioStateKey, JSON.stringify({
        currentTime: Number.isFinite(audio.currentTime) ? audio.currentTime : 0,
        shouldPlay: soundEnabled && !audio.paused,
        volume: audio.volume,
        savedAt: Date.now(),
      }));
    } catch {
      // O convite continua funcionando mesmo se o navegador bloquear o armazenamento.
    }
  };

  const playAudio = async (restart = false) => {
    if (!soundEnabled) return;
    if (restart) audio.currentTime = 0;
    audio.volume = 0.62;
    try {
      await audio.play();
    } catch {
      soundEnabled = false;
      updateSoundButton();
    }
  };

  const showFinal = () => {
    clearTimers();
    experience.classList.remove("is-between-scenes");
    setScene("final");
  };

  const runAnimation = ({ restartAudio = false } = {}) => {
    clearTimers();
    experience.classList.add("is-started");

    if (reduceMotion.matches) {
      setScene("final");
      playAudio(restartAudio);
      return;
    }

    setScene("reveal");
    if (revealVideo) {
      revealVideo.currentTime = 0;
      revealVideo.play().catch(() => {});
    }
    playAudio(restartAudio);
    later(() => experience.classList.add("is-between-scenes"), 6000);
    later(() => setScene("final"), 6550);
    later(() => experience.classList.remove("is-between-scenes"), 7400);
  };

  startButton.addEventListener("click", () => runAnimation({ restartAudio: true }));
  replayButton.addEventListener("click", () => runAnimation({ restartAudio: true }));
  skipButton.addEventListener("click", showFinal);

  soundButton.addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    audio.muted = !soundEnabled;
    updateSoundButton();
    if (soundEnabled && audio.paused) playAudio(false);
    saveAudioState();
  });

  confirmButton.addEventListener("click", (event) => {
    event.preventDefault();
    if (navigatingToRsvp) return;
    navigatingToRsvp = true;
    saveAudioState();
    const destination = confirmButton.href;
    if (reduceMotion.matches) {
      window.location.href = destination;
      return;
    }
    experience.classList.add("is-departing");
    window.setTimeout(() => { window.location.href = destination; }, 1050);
  });
  window.addEventListener("pagehide", () => {
    if (!navigatingToRsvp) saveAudioState();
  });

  audio.addEventListener("ended", () => {
    soundEnabled = false;
    updateSoundButton();
  });

  reduceMotion.addEventListener?.("change", (event) => {
    if (event.matches && experience.classList.contains("is-started")) showFinal();
  });

  updateSoundButton();
})();
