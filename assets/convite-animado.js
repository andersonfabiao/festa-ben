(async () => {
  if (window.__benInviteVersionCheck && await window.__benInviteVersionCheck) return;
  const inviteRelease = "20261111p3";
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
  const greetingScene = document.querySelector("#greetingScene");
  const greetingVideo = document.querySelector("#greetingVideo");
  const audio = document.querySelector("#themeAudio");
  const benVoice = document.querySelector("#benVoiceAudio");
  const benVoiceCue = document.querySelector("#benVoiceCue");
  const benVoiceCueHint = document.querySelector("#benVoiceCueHint");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const audioStateKey = "ben-invite-audio";

  // Quando o link vem do WhatsApp de um convidado, leva a chave para a confirmação
  // e preserva o link de retorno ao convite animado.
  try {
    const inviteKey = new URLSearchParams(window.location.search).get("convite");
    if (inviteKey && confirmButton) {
      const returnTarget = "convite-animado.html?convite=" + encodeURIComponent(inviteKey);
      confirmButton.href =
        "convite.html?music=1&v=" + encodeURIComponent(inviteRelease) +
        "&convite=" + encodeURIComponent(inviteKey) +
        "&voltar=" + encodeURIComponent(returnTarget);
    }
  } catch (e) {
    /* ignora */
  }
  let timers = [];
  let soundEnabled = true;
  let navigatingToRsvp = false;
  let preludeFinishing = false;
  let startOpeningTheme = () => {};
  let voicePreDuckTimer = 0;
  let voiceTimer = 0;
  let voiceRestoreTimer = 0;
  let volumeFrame = 0;
  let buzzStarted = false;
  let buzzSoundUnlocked = false;
  let voicePrimed = false;
  let voicePriming = false;
  let voiceDuckActive = false;
  let greetingRunId = 0;
  // Compensa a masterização: a música fica bem abaixo da voz do Ben.
  const themeVolume = 0.085;
  // Durante o recado a trilha desce quase ao silêncio para destacar a voz do Ben.
  const duckedThemeVolume = 0.002;
  const benVoiceBoost = 1.45;
  let currentThemeVolume = themeVolume;
  let audioCtx = null;
  let themeGain = null;
  let voiceGain = null;

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
    }, 360);
    window.setTimeout(() => experience.classList.remove("is-prelude-transition"), 1500);
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
    if (!buzzPreludeVideo) return;
    buzzSoundUnlocked = true;
    buzzPreludeVideo.muted = false;
    buzzPreludeVideo.volume = 0.9;
    buzzPreludeVideo.play().catch(() => {
      // Só volta a mutar se o navegador recusar o som mesmo depois do gesto.
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
        if (buzzSoundUnlocked) {
          // O gesto do usuário chegou antes da recusa do autoplay: tenta de novo
          // com som em vez de mutar por cima da ativação.
          await buzzPreludeVideo.play().catch(() => {
            buzzPreludeVideo.muted = true;
            updateBuzzSoundControl();
            buzzPreludeVideo.play().catch(finishPrelude);
          });
        } else {
          buzzPreludeVideo.muted = true;
          updateBuzzSoundControl();
          buzzPreludeVideo.play().catch(finishPrelude);
        }
      }
      window.setTimeout(finishPrelude, 16000);
    };
    if (buzzPreludeVideo.readyState >= 1) startBuzz();
    else buzzPreludeVideo.addEventListener("loadedmetadata", startBuzz, { once: true });

    if (buzzSoundToggle) {
      buzzSoundToggle.addEventListener("click", (event) => {
        event.stopPropagation();
        const willUnmute = buzzPreludeVideo.muted;
        buzzSoundUnlocked = willUnmute;
        buzzPreludeVideo.muted = !willUnmute;
        if (willUnmute) buzzPreludeVideo.play().catch(() => {});
        updateBuzzSoundControl();
      });
    }
    if (buzzSkip) buzzSkip.addEventListener("click", (event) => {
      event.stopPropagation();
      ensureAudioMixer();
      finishPrelude();
    });
    if (buzzPrelude) buzzPrelude.addEventListener("click", () => {
      ensureAudioMixer();
      enableBuzzSound();
    });
  } else {
    finishPrelude();
  }

  const setThemeVolume = (level) => {
    const safeLevel = Math.max(0, Math.min(1, Number(level) || 0));
    currentThemeVolume = safeLevel;
    if (themeGain && audioCtx) {
      themeGain.gain.value = safeLevel;
      audio.volume = 1;
    } else if (audio) {
      audio.volume = safeLevel;
    }
  };

  const ensureAudioMixer = () => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      if (!audioCtx) {
        audioCtx = new AudioContextClass();
        const themeSource = audioCtx.createMediaElementSource(audio);
        themeGain = audioCtx.createGain();
        themeGain.gain.value = currentThemeVolume;
        audio.volume = 1;
        themeSource.connect(themeGain);
        themeGain.connect(audioCtx.destination);

        if (benVoice) {
          const voiceSource = audioCtx.createMediaElementSource(benVoice);
          const compressor = audioCtx.createDynamicsCompressor();
          compressor.threshold.value = -3;
          compressor.knee.value = 6;
          compressor.ratio.value = 10;
          compressor.attack.value = 0.003;
          compressor.release.value = 0.15;
          voiceGain = audioCtx.createGain();
          voiceGain.gain.value = benVoiceBoost;
          benVoice.volume = 1;
          voiceSource.connect(compressor);
          compressor.connect(voiceGain);
          voiceGain.connect(audioCtx.destination);
        }
      }
      if (audioCtx.state === "suspended") {
        audioCtx.resume().catch(() => {});
      }
    } catch {
      // Fallback para controle de volume padrão caso Web Audio falhe.
    }
  };

  const clearTimers = () => {
    timers.forEach(window.clearTimeout);
    timers = [];
  };

  const setVoiceCue = (visible, needsTap = false) => {
    if (!benVoiceCue) return;
    const copy = Object.assign(
      {
        voiceCueHint: "Escute só um pouquinho…",
        voiceCueTapHint: "Toque para ouvir o Ben",
      },
      window.BEN_INVITE_COPY || {}
    );
    benVoiceCue.classList.toggle("is-visible", visible);
    benVoiceCue.classList.toggle("needs-tap", needsTap);
    benVoiceCue.setAttribute("aria-hidden", String(!visible));
    benVoiceCue.tabIndex = visible && needsTap ? 0 : -1;
    if (benVoiceCueHint) {
      benVoiceCueHint.textContent = needsTap ? copy.voiceCueTapHint : copy.voiceCueHint;
    }
  };

  const primeBenVoice = () => {
    if (!benVoice || voicePrimed || voicePriming || !soundEnabled) return;
    // O recado só pode ser preparado depois que o Buzz sai da tela. Antes disso
    // o áudio é apenas liberado, sem tocar nenhum trecho da fala.
    if (experience.classList.contains("is-buzz-playing") ||
        !experience.classList.contains("is-prelude-complete")) return;
    // O priming é mudo para não vazar áudio (no iPhone o volume é ignorado).
    voicePriming = true;
    benVoice.muted = true;
    benVoice.currentTime = 0;
    const attempt = benVoice.play();
    if (!attempt) {
      voicePriming = false;
      benVoice.muted = false;
      return;
    }
    attempt.then(() => {
      benVoice.pause();
      benVoice.currentTime = 0;
      benVoice.muted = false;
      benVoice.volume = 1;
      voicePrimed = true;
      voicePriming = false;
    }).catch(() => {
      benVoice.muted = false;
      benVoice.volume = 1;
      voicePriming = false;
    });
  };

  // Safari/iPhone exige que a voz seja liberada pelo próprio toque. Um play
  // apenas no modo mudo não garante a reprodução automática alguns segundos
  // depois, quando a tela final aparece.
  const unlockBenVoiceOnGesture = () => {
    if (!benVoice || voicePrimed || !soundEnabled) return;
    try {
      ensureAudioMixer();
      if (benVoice.readyState < 2) benVoice.load();
      benVoice.muted = false;
      benVoice.volume = 1;
      benVoice.currentTime = 0;
      const attempt = benVoice.play();
      benVoice.pause();
      benVoice.currentTime = 0;
      voicePrimed = true;
      if (attempt?.catch) {
        attempt.catch((error) => {
          if (error?.name === "NotAllowedError") voicePrimed = false;
        });
      }
    } catch {
      voicePrimed = false;
    }
  };

  const fadeThemeTo = (target, duration = 650) => {
    if (!audio) return;
    cancelAnimationFrame(volumeFrame);
    const initial = currentThemeVolume;
    const startedAt = performance.now();
    const fade = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      setThemeVolume(initial + ((target - initial) * progress));
      if (progress < 1) volumeFrame = requestAnimationFrame(fade);
    };
    volumeFrame = requestAnimationFrame(fade);
  };

  const stopBenVoice = ({ restoreTheme = true } = {}) => {
    window.clearTimeout(voiceTimer);
    window.clearTimeout(voicePreDuckTimer);
    window.clearTimeout(voiceRestoreTimer);
    voiceDuckActive = false;
    if (benVoice && !voicePriming && !benVoice.paused) benVoice.pause();
    if (benVoice && !voicePriming) benVoice.currentTime = 0;
    setVoiceCue(false);
    if (restoreTheme && soundEnabled && !audio.paused) fadeThemeTo(themeVolume, 700);
  };

  const playBenVoice = async () => {
    if (!soundEnabled || !benVoice || experience.classList.contains("is-departing")) return;
    // Enquanto o Buzz está na tela o recado não aparece nem toca.
    if (experience.classList.contains("is-buzz-playing") ||
        !experience.classList.contains("is-prelude-complete")) return;
    ensureAudioMixer();
    voiceDuckActive = true;
    setVoiceCue(true);
    // A trilha fica quase imperceptível durante a fala para a voz do Ben se sobressair.
    fadeThemeTo(duckedThemeVolume, 180);
    benVoice.currentTime = 0;
    benVoice.volume = 1;
    benVoice.muted = false;
    try {
      await benVoice.play();
    } catch {
      voiceDuckActive = false;
      setVoiceCue(true, true);
      fadeThemeTo(themeVolume, 550);
    }
  };

  const scheduleBenVoice = (delay = 1250) => {
    window.clearTimeout(voiceTimer);
    window.clearTimeout(voicePreDuckTimer);
    window.clearTimeout(voiceRestoreTimer);
    const preDuckDelay = Math.max(0, delay - 450);
    voicePreDuckTimer = window.setTimeout(() => {
      if (!soundEnabled || !benVoice || experience.classList.contains("is-departing")) return;
      if (experience.classList.contains("is-buzz-playing") ||
          !experience.classList.contains("is-prelude-complete")) return;
      voiceDuckActive = true;
      fadeThemeTo(duckedThemeVolume, 320);
    }, preDuckDelay);
    voiceTimer = window.setTimeout(playBenVoice, delay);
  };

  const later = (callback, delay) => {
    timers.push(window.setTimeout(callback, delay));
  };

  const setScene = (scene) => {
    experience.classList.remove("is-reveal", "is-reveal-leaving", "is-greeting", "is-greeting-leaving", "is-intro", "is-envelope", "is-final");
    experience.classList.add(`is-${scene}`);
    if (scene !== "reveal" && revealVideo) revealVideo.pause();
    if (scene !== "greeting" && greetingVideo) greetingVideo.pause();
    if (greetingScene) greetingScene.setAttribute("aria-hidden", String(scene !== "greeting"));
    if (scene === "final") finalInvite.focus({ preventScroll: true });
  };

  const playGreeting = () => {
    if (!greetingVideo) {
      setScene("final");
      scheduleBenVoice();
      return;
    }
    const runId = ++greetingRunId;
    let finished = false;
    const finish = () => {
      if (finished || runId !== greetingRunId || !experience.classList.contains("is-greeting")) return;
      finished = true;
      experience.classList.add("is-greeting-leaving");
      later(() => {
        if (runId !== greetingRunId) return;
        setScene("final");
        scheduleBenVoice(850);
      }, 520);
    };
    setScene("greeting");
    greetingVideo.currentTime = 0;
    greetingVideo.addEventListener("ended", finish, { once: true });
    greetingVideo.play().catch(() => later(finish, 800));
    later(finish, 2850);
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
        volume: currentThemeVolume,
        savedAt: Date.now(),
      }));
    } catch {
      // O convite continua funcionando mesmo se o navegador bloquear o armazenamento.
    }
  };

  const playAudio = async (restart = false) => {
    if (!soundEnabled) return;
    if (restart) audio.currentTime = 0;
    setThemeVolume(voiceDuckActive ? duckedThemeVolume : themeVolume);
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
    const openingVolume = 0.008;
    setThemeVolume(openingVolume);
    try {
      await audio.play();
      const startedAt = performance.now();
      const fade = (now) => {
        if (audio.paused || !soundEnabled || voiceDuckActive) return;
        const progress = Math.min(1, (now - startedAt) / 950);
        setThemeVolume(openingVolume + ((themeVolume - openingVolume) * progress));
        if (progress < 1) requestAnimationFrame(fade);
      };
      requestAnimationFrame(fade);
    } catch {
      // Celulares que bloqueiam autoplay iniciarão a música no botão Abrir convite.
    }
  };

  const showFinal = () => {
    clearTimers();
    greetingRunId += 1;
    stopBenVoice({ restoreTheme: true });
    experience.classList.remove("is-between-scenes");
    setScene("final");
    scheduleBenVoice(700);
  };

  const runAnimation = ({ restartAudio = false } = {}) => {
    clearTimers();
    greetingRunId += 1;
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
      if (revealVideo.preload === "none") {
        revealVideo.preload = "metadata";
        revealVideo.load();
      }
      revealVideo.currentTime = 0;
      revealVideo.play().catch(() => {});
    }
    playAudio(restartAudio);
    const revealDuration = revealVideo && Number.isFinite(revealVideo.duration)
      ? Math.max(6500, Math.round(revealVideo.duration * 1000))
      : 6700;
    const transitionAt = Math.max(6200, revealDuration - 120);
    later(() => experience.classList.add("is-between-scenes"), transitionAt);
    later(() => {
      playGreeting();
    }, transitionAt + 550);
    later(() => experience.classList.remove("is-between-scenes"), transitionAt + 1400);
  };

  startButton.addEventListener("pointerdown", unlockBenVoiceOnGesture, { passive: true });
  replayButton.addEventListener("pointerdown", unlockBenVoiceOnGesture, { passive: true });
  startButton.addEventListener("click", () => {
    ensureAudioMixer();
    unlockBenVoiceOnGesture();
    runAnimation({ restartAudio: false });
  });
  replayButton.addEventListener("click", () => {
    ensureAudioMixer();
    unlockBenVoiceOnGesture();
    runAnimation({ restartAudio: true });
  });
  skipButton.addEventListener("click", showFinal);

  soundButton.addEventListener("click", () => {
    ensureAudioMixer();
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
    setThemeVolume(themeVolume);
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
    benVoice.addEventListener("play", () => {
      if (voicePriming || benVoice.muted) return;
      window.clearTimeout(voiceRestoreTimer);
      voiceDuckActive = true;
      fadeThemeTo(duckedThemeVolume, 150);
    });
    benVoice.addEventListener("ended", () => {
      setVoiceCue(false);
      voiceDuckActive = false;
      window.clearTimeout(voiceRestoreTimer);
      voiceRestoreTimer = window.setTimeout(() => {
        if (soundEnabled && !audio.paused && !voiceDuckActive) {
          fadeThemeTo(themeVolume, 1100);
        }
      }, 350);
    });
  }

  if (benVoiceCue) {
    benVoiceCue.addEventListener("pointerdown", unlockBenVoiceOnGesture, { passive: true });
    benVoiceCue.addEventListener("click", () => {
      if (!benVoiceCue.classList.contains("needs-tap")) return;
      ensureAudioMixer();
      playBenVoice();
    });
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") window.__checkBenInviteVersion?.();
  });

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

  const unlockOnFirstGesture = (event) => {
    ensureAudioMixer();
    const target = event && event.target;
    const handledByPrelude = target && target.closest &&
      target.closest("#buzzSoundToggle, #buzzSkip");
    if (!handledByPrelude && !preludeFinishing && buzzStarted && buzzPreludeVideo &&
        buzzPreludeVideo.muted && !buzzPreludeVideo.ended) {
      enableBuzzSound();
    }
    // Só prepara a voz do Ben depois que a abertura do Buzz termina.
    if (experience.classList.contains("is-prelude-complete")) primeBenVoice();
  };
  document.addEventListener("pointerdown", unlockOnFirstGesture, { once: true, passive: true });
  document.addEventListener("keydown", unlockOnFirstGesture, { once: true });

  updateSoundButton();
})();
