(() => {
  const experience = document.querySelector("#experience");
  const buzzPrelude = document.querySelector("#buzzPrelude");
  const buzzPreludeVideo = document.querySelector("#buzzPreludeVideo");
  const buzzSoundToggle = document.querySelector("#buzzSoundToggle");
  const buzzSkip = document.querySelector("#buzzSkip");
  const startButton = document.querySelector("#startButton");
  const soundButton = document.querySelector("#soundButton");
  const replayButton = document.querySelector("#replayButton");
  const skipButton = document.querySelector("#skipButton");
  const confirmButton = document.querySelector("#confirmButton");
  const finalInvite = document.querySelector("#finalInvite");
  const revealVideo = document.querySelector("#revealVideo");
  const audio = document.querySelector("#themeAudio");
  const benVoice = document.querySelector("#benVoiceAudio");
  const benVoiceCue = document.querySelector("#benVoiceCue");
  const benVoiceCueHint = document.querySelector("#benVoiceCueHint");
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
  let preludeFinishing = false;
  let startOpeningTheme = () => {};
  let voiceTimer = 0;
  let volumeFrame = 0;
  let buzzStarted = false;
  let voicePrimed = false;
  const themeVolume = 0.62;

  const finishPrelude = () => {
    if (preludeFinishing || experience.classList.contains("is-prelude-complete")) return;
    preludeFinishing = true;
    experience.classList.remove("is-buzz-playing");
    if (buzzPreludeVideo) buzzPreludeVideo.pause();
    if (reduceMotion.matches) {
      experience.classList.add("is-prelude-complete");
      startOpeningTheme();
      return;
    }

    // A fumaça nasce no ponto em que o Buzz cai, cobre o corte entre as cenas
    // e revela a carta somente depois do branco total.
    experience.classList.add("is-prelude-transition", "is-impacting");
    window.setTimeout(() => experience.classList.remove("is-impacting"), 680);
    window.setTimeout(() => {
      experience.classList.add("is-prelude-complete");
      startOpeningTheme();
    }, 820);
    window.setTimeout(() => experience.classList.remove("is-prelude-transition"), 2850);
  };

  const updateBuzzSoundControl = () => {
    if (!buzzSoundToggle || !buzzPreludeVideo) return;
    const isMuted = buzzPreludeVideo.muted;
    buzzSoundToggle.firstElementChild.textContent = isMuted ? "🔇" : "🔊";
    buzzSoundToggle.setAttribute("aria-label", isMuted ? "Ativar som do Buzz" : "Deixar Buzz sem som");
    buzzSoundToggle.setAttribute("aria-pressed", String(isMuted));
    experience.classList.toggle("is-buzz-sound-on", !isMuted);
  };

  const enableBuzzSound = () => {
    if (!buzzPreludeVideo || !buzzPreludeVideo.muted) return;
    buzzPreludeVideo.muted = false;
    buzzPreludeVideo.volume = 0.9;
    buzzPreludeVideo.play().catch(() => {
      buzzPreludeVideo.muted = true;
      updateBuzzSoundControl();
    });
    updateBuzzSoundControl();
  };

  const rewindBuzz = () => {
    if (!buzzPreludeVideo) return;
    buzzPreludeVideo.pause();
    try { buzzPreludeVideo.currentTime = 0; } catch { /* aguarda loadedmetadata */ }
  };

  if (buzzPreludeVideo) rewindBuzz();

  if (reduceMotion.matches) {
    finishPrelude();
  } else if (buzzPreludeVideo) {
    buzzPreludeVideo.addEventListener("ended", finishPrelude, { once: true });
    buzzPreludeVideo.muted = false;
    buzzPreludeVideo.volume = 0.9;
    const startBuzz = async () => {
      if (buzzStarted || preludeFinishing) return;
      buzzStarted = true;
      rewindBuzz();
      experience.classList.add("is-buzz-playing");
      updateBuzzSoundControl();
      try {
        await buzzPreludeVideo.play();
      } catch {
        buzzPreludeVideo.muted = true;
        updateBuzzSoundControl();
        buzzPreludeVideo.play().catch(finishPrelude);
      }
      window.setTimeout(finishPrelude, 16000);
    };
    if (buzzPreludeVideo.readyState >= 1) startBuzz();
    else buzzPreludeVideo.addEventListener("loadedmetadata", startBuzz, { once: true });

    if (buzzSoundToggle) {
      buzzSoundToggle.addEventListener("click", (event) => {
        event.stopPropagation();
        buzzPreludeVideo.muted = !buzzPreludeVideo.muted;
        if (!buzzPreludeVideo.muted) buzzPreludeVideo.play().catch(() => {});
        updateBuzzSoundControl();
      });
    }
    if (buzzSkip) buzzSkip.addEventListener("click", (event) => {
      event.stopPropagation();
      finishPrelude();
    });
    if (buzzPrelude) buzzPrelude.addEventListener("click", enableBuzzSound);
  } else {
    finishPrelude();
  }

  const clearTimers = () => {
    timers.forEach(window.clearTimeout);
    timers = [];
  };

  const setVoiceCue = (visible, needsTap = false) => {
    if (!benVoiceCue) return;
    benVoiceCue.classList.toggle("is-visible", visible);
    benVoiceCue.classList.toggle("needs-tap", needsTap);
    benVoiceCue.setAttribute("aria-hidden", String(!visible));
    benVoiceCue.tabIndex = visible && needsTap ? 0 : -1;
    if (benVoiceCueHint) benVoiceCueHint.textContent = needsTap ? "Toque para ouvir o Ben" : "Escute só um pouquinho…";
  };

  const primeBenVoice = () => {
    if (!benVoice || voicePrimed || !soundEnabled) return;
    const previousVolume = benVoice.volume;
    benVoice.muted = false;
    benVoice.volume = 0.001;
    benVoice.currentTime = 0;
    const attempt = benVoice.play();
    if (!attempt) return;
    attempt.then(() => {
      benVoice.pause();
      benVoice.currentTime = 0;
      benVoice.volume = previousVolume || 0.96;
      voicePrimed = true;
    }).catch(() => {
      benVoice.volume = previousVolume || 0.96;
    });
  };

  const fadeThemeTo = (target, duration = 650) => {
    if (!audio) return;
    cancelAnimationFrame(volumeFrame);
    const initial = audio.volume;
    const startedAt = performance.now();
    const fade = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      audio.volume = initial + ((target - initial) * progress);
      if (progress < 1) volumeFrame = requestAnimationFrame(fade);
    };
    volumeFrame = requestAnimationFrame(fade);
  };

  const stopBenVoice = ({ restoreTheme = true } = {}) => {
    window.clearTimeout(voiceTimer);
    if (benVoice && !benVoice.paused) benVoice.pause();
    if (benVoice) benVoice.currentTime = 0;
    setVoiceCue(false);
    if (restoreTheme && soundEnabled && !audio.paused) fadeThemeTo(themeVolume, 700);
  };

  const playBenVoice = async () => {
    if (!soundEnabled || !benVoice || experience.classList.contains("is-departing")) return;
    setVoiceCue(true);
    fadeThemeTo(0.11, 700);
    benVoice.currentTime = 0;
    benVoice.volume = 0.96;
    benVoice.muted = false;
    try {
      await benVoice.play();
    } catch {
      setVoiceCue(true, true);
      fadeThemeTo(themeVolume, 550);
    }
  };

  const scheduleBenVoice = (delay = 1250) => {
    window.clearTimeout(voiceTimer);
    voiceTimer = window.setTimeout(playBenVoice, delay);
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

  startOpeningTheme = async () => {
    if (!soundEnabled || !audio.paused) return;
    audio.currentTime = 0;
    audio.volume = 0.06;
    try {
      await audio.play();
      const startedAt = performance.now();
      const fade = (now) => {
        if (audio.paused || !soundEnabled) return;
        const progress = Math.min(1, (now - startedAt) / 950);
        audio.volume = 0.06 + (0.56 * progress);
        if (progress < 1) requestAnimationFrame(fade);
      };
      requestAnimationFrame(fade);
    } catch {
      // Celulares que bloqueiam autoplay iniciarão a música no botão Abrir convite.
    }
  };

  const showFinal = () => {
    clearTimers();
    stopBenVoice({ restoreTheme: true });
    experience.classList.remove("is-between-scenes");
    setScene("final");
  };

  const runAnimation = ({ restartAudio = false } = {}) => {
    clearTimers();
    stopBenVoice({ restoreTheme: false });
    experience.classList.add("is-started");

    if (reduceMotion.matches) {
      setScene("final");
      playAudio(restartAudio);
      scheduleBenVoice(900);
      return;
    }

    setScene("reveal");
    if (revealVideo) {
      revealVideo.currentTime = 0;
      revealVideo.play().catch(() => {});
    }
    playAudio(restartAudio);
    later(() => experience.classList.add("is-between-scenes"), 6000);
    later(() => {
      setScene("final");
      scheduleBenVoice();
    }, 6550);
    later(() => experience.classList.remove("is-between-scenes"), 7400);
  };

  startButton.addEventListener("click", () => {
    primeBenVoice();
    runAnimation({ restartAudio: false });
  });
  replayButton.addEventListener("click", () => {
    primeBenVoice();
    runAnimation({ restartAudio: true });
  });
  skipButton.addEventListener("click", showFinal);

  soundButton.addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    audio.muted = !soundEnabled;
    if (benVoice) benVoice.muted = !soundEnabled;
    if (!soundEnabled) stopBenVoice({ restoreTheme: false });
    updateSoundButton();
    if (soundEnabled && audio.paused) playAudio(false);
    saveAudioState();
  });

  confirmButton.addEventListener("click", (event) => {
    event.preventDefault();
    if (navigatingToRsvp) return;
    navigatingToRsvp = true;
    stopBenVoice({ restoreTheme: false });
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

  if (benVoice) {
    benVoice.addEventListener("ended", () => {
      setVoiceCue(false);
      if (soundEnabled && !audio.paused) fadeThemeTo(themeVolume, 900);
    });
  }

  if (benVoiceCue) {
    benVoiceCue.addEventListener("click", () => {
      if (!benVoiceCue.classList.contains("needs-tap")) return;
      playBenVoice();
    });
  }

  window.addEventListener("pageshow", (event) => {
    if (!event.persisted || experience.classList.contains("is-prelude-complete")) return;
    buzzStarted = false;
    preludeFinishing = false;
    rewindBuzz();
    if (buzzPreludeVideo.readyState >= 1) {
      buzzPreludeVideo.play().catch(() => {
        buzzPreludeVideo.muted = true;
        updateBuzzSoundControl();
        buzzPreludeVideo.play().catch(finishPrelude);
      });
      buzzStarted = true;
    }
  });

  reduceMotion.addEventListener?.("change", (event) => {
    if (event.matches && experience.classList.contains("is-started")) showFinal();
  });

  updateSoundButton();
})();
