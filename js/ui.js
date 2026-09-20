/**
 * Administrador de Interfaz de Usuario para Flora: Ayúdala a mantener la calma
 * Gestiona navegación entre pantallas, validación en español, HUD y leaderboard
 */

class UIManager {
  constructor() {
    this.game = null;
    this.currentScreen = 'start';
    this.lastResultData = null;
    this.hasSavedCurrentScore = false;

    // Elementos del DOM
    this.screens = {
      start: document.getElementById('screen-start'),
      game: document.getElementById('screen-game'),
      result: document.getElementById('screen-result'),
      leaderboard: document.getElementById('screen-leaderboard')
    };

    // HUD
    this.hudScore = document.getElementById('hud-score');
    this.hudTimer = document.getElementById('hud-timer');
    this.hudEntanglements = document.getElementById('hud-entanglements');

    // Inputs y botones
    this.inputPlayerName = document.getElementById('player-name-input');
    this.nameErrorMsg = document.getElementById('name-error-msg');
    this.btnStart = document.getElementById('btn-start');
    this.btnShowLeaderboard = document.getElementById('btn-leaderboard-menu');
    this.btnBackFromLeaderboard = document.getElementById('btn-back-leaderboard');
    this.btnSaveScore = document.getElementById('btn-save-score');
    this.btnPlayAgain = document.getElementById('btn-play-again');
    this.btnLeaderboardFromResult = document.getElementById('btn-leaderboard-result');
    this.btnMute = document.getElementById('btn-mute-toggle');
    this.btnPause = document.getElementById('btn-pause');

    // Modal de Pausa
    this.modalPause = document.getElementById('modal-pause');
    this.btnResume = document.getElementById('btn-resume');
    this.btnQuitGame = document.getElementById('btn-quit');

    this._init();
  }

  setGame(gameInstance) {
    this.game = gameInstance;
  }

  _init() {
    // Restaurar último nombre guardado si existe
    if (window.scoreStorage) {
      const lastName = window.scoreStorage.getLastName();
      if (lastName && this.inputPlayerName) {
        this.inputPlayerName.value = lastName;
      }
    }

    // Actualizar icono de silencio inicial
    this._updateMuteButtonVisual();

    // Eventos de botones
    this.btnStart.addEventListener('click', () => this.handleStartClick());
    this.inputPlayerName.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.handleStartClick();
    });

    this.btnShowLeaderboard.addEventListener('click', () => {
      this.renderLeaderboard();
      this.showScreen('leaderboard');
    });

    this.btnBackFromLeaderboard.addEventListener('click', () => {
      if (this.lastResultData && !this.game.isRunning) {
        this.showScreen('result');
      } else {
        this.showScreen('start');
      }
    });

    this.btnSaveScore.addEventListener('click', () => this.handleSaveScoreClick());
    this.btnPlayAgain.addEventListener('click', () => this.handlePlayAgainClick());
    this.btnLeaderboardFromResult.addEventListener('click', () => {
      this.renderLeaderboard();
      this.showScreen('leaderboard');
    });

    // Mute
    this.btnMute.addEventListener('click', () => {
      if (window.audioManager) {
        const isMuted = window.audioManager.toggleMute();
        this._updateMuteButtonVisual(isMuted);
      }
    });

    // Pausa
    this.btnPause.addEventListener('click', () => this.togglePause());
    this.btnResume.addEventListener('click', () => this.togglePause());
    this.btnQuitGame.addEventListener('click', () => {
      this.modalPause.classList.add('hidden');
      if (this.game) this.game.stopGame();
      this.showScreen('start');
    });
  }

  _updateMuteButtonVisual(muted) {
    const isMuted = muted !== undefined ? muted : (window.audioManager ? window.audioManager.isMuted : false);
    if (this.btnMute) {
      this.btnMute.innerHTML = isMuted ? '🔇 <span class="btn-text">Sonido: NO</span>' : '🔊 <span class="btn-text">Sonido: SÍ</span>';
      this.btnMute.setAttribute('aria-label', isMuted ? 'Activar sonido' : 'Silenciar');
    }
  }

  showScreen(screenKey) {
    this.currentScreen = screenKey;
    for (const [key, el] of Object.entries(this.screens)) {
      if (el) {
        if (key === screenKey) {
          el.classList.remove('hidden');
        } else {
          el.classList.add('hidden');
        }
      }
    }

    if (screenKey === 'game' && this.game) {
      setTimeout(() => this.game.resize(), 50);
    }
  }

  handleStartClick() {
    const rawName = this.inputPlayerName.value.trim();
    if (!rawName) {
      this.nameErrorMsg.textContent = '¡Por favor ingresa tu nombre para comenzar!';
      this.nameErrorMsg.classList.remove('hidden');
      this.inputPlayerName.focus();
      return;
    }

    this.nameErrorMsg.classList.add('hidden');
    const playerName = rawName.toUpperCase();
    if (window.scoreStorage) {
      window.scoreStorage.setLastName(playerName);
    }

    this.showScreen('game');
    if (this.game) {
      this.game.startGame(playerName);
    }
  }

  updateHUD(score, timer, entanglements) {
    if (this.hudScore) {
      this.hudScore.textContent = `PUNTAJE: ${score}`;
    }
    if (this.hudTimer) {
      this.hudTimer.textContent = `TIEMPO: ${timer}`;
      if (timer <= 20) {
        this.hudTimer.classList.add('timer-urgent');
      } else {
        this.hudTimer.classList.remove('timer-urgent');
      }
    }
    if (this.hudEntanglements) {
      this.hudEntanglements.textContent = `ENREDOS: ${entanglements} / 3`;
      if (entanglements >= 3) {
        this.hudEntanglements.className = 'hud-item hud-danger';
      } else if (entanglements >= 2) {
        this.hudEntanglements.className = 'hud-item hud-warning';
      } else {
        this.hudEntanglements.className = 'hud-item';
      }
    }
  }

  togglePause() {
    if (!this.game || !this.game.isRunning) return;

    if (this.game.isPaused) {
      this.modalPause.classList.add('hidden');
      this.game.resumeGame();
      this.btnPause.textContent = '⏸️ Pausa';
    } else {
      this.modalPause.classList.remove('hidden');
      this.game.pauseGame();
      this.btnPause.textContent = '▶️ Continuar';
    }
  }

  showResultScreen(data) {
    this.lastResultData = data;
    this.hasSavedCurrentScore = false;

    const resTitle = document.getElementById('result-title');
    const resSubtitle = document.getElementById('result-subtitle');
    const resScore = document.getElementById('result-score');
    const resPlants = document.getElementById('result-plants');
    const resEntanglements = document.getElementById('result-entanglements');
    const resCombo = document.getElementById('result-combo');
    const resPortrait = document.getElementById('result-portrait');
    const saveNotice = document.getElementById('save-confirm-msg');

    if (saveNotice) saveNotice.classList.add('hidden');
    this.btnSaveScore.disabled = false;
    this.btnSaveScore.innerHTML = '💾 GUARDAR PUNTAJE';
    this.btnSaveScore.classList.remove('saved');

    if (data.isWin) {
      resTitle.textContent = '¡TIEMPO!';
      resTitle.className = 'result-title win';
      resSubtitle.textContent = '¡LO LOGRASTE!';
      resPortrait.src = 'assets/flora_victoriosa.png';
      resPortrait.alt = 'Flora Victoriosa';
      this.btnPlayAgain.textContent = 'JUGAR DE NUEVO';
    } else {
      resTitle.textContent = 'FLORA ESTÁ ABRUMADA';
      resTitle.className = 'result-title lose';
      resSubtitle.textContent = 'La ansiedad fue demasiada esta vez... ¡Respira hondo y prueba otra vez!';
      resPortrait.src = 'assets/flora_enredada.png';
      resPortrait.alt = 'Flora Abrumada';
      this.btnPlayAgain.textContent = 'INTENTAR DE NUEVO';
    }

    resScore.textContent = `PUNTAJE FINAL: ${data.score}`;
    resPlants.textContent = `PLANTAS CORTADAS: ${data.plantsCut}`;
    resEntanglements.textContent = `ENREDOS: ${data.entanglements} / 3`;
    if (resCombo) {
      resCombo.textContent = `MEJOR COMBO: x${data.maxCombo}`;
    }

    this.showScreen('result');
  }

  handleSaveScoreClick() {
    if (this.hasSavedCurrentScore || !this.lastResultData) return;

    const res = window.scoreStorage.saveScore(
      this.lastResultData.playerName,
      this.lastResultData.score,
      this.lastResultData.plantsCut,
      this.lastResultData.entanglements,
      this.lastResultData.maxCombo
    );

    if (res.success) {
      this.hasSavedCurrentScore = true;
      this.btnSaveScore.disabled = true;
      this.btnSaveScore.innerHTML = '✅ ¡PUNTAJE GUARDADO!';
      this.btnSaveScore.classList.add('saved');

      const saveNotice = document.getElementById('save-confirm-msg');
      if (saveNotice) {
        saveNotice.textContent = res.isTop10
          ? `¡Felicidades! Lograste la posición #${res.rank} en el Top 10.`
          : 'Puntaje guardado con éxito.';
        saveNotice.classList.remove('hidden');
      }
    }
  }

  handlePlayAgainClick() {
    const playerName = (this.lastResultData && this.lastResultData.playerName)
      ? this.lastResultData.playerName
      : (this.inputPlayerName.value.trim().toUpperCase() || 'JUGADOR');

    this.showScreen('game');
    if (this.game) {
      this.game.startGame(playerName);
    }
  }

  renderLeaderboard() {
    const listContainer = document.getElementById('leaderboard-list');
    if (!listContainer) return;

    const scores = window.scoreStorage.getLeaderboard();
    listContainer.innerHTML = '';

    if (scores.length === 0) {
      listContainer.innerHTML = '<div class="leaderboard-empty">Aún no hay puntajes registrados. ¡Sé el primero en jugar!</div>';
      return;
    }

    scores.forEach((entry, idx) => {
      const row = document.createElement('div');
      row.className = `leaderboard-row rank-${idx + 1}`;

      let medal = '';
      if (idx === 0) medal = '🥇 ';
      else if (idx === 1) medal = '🥈 ';
      else if (idx === 2) medal = '🥉 ';

      row.innerHTML = `
        <div class="lb-rank">${medal}${idx + 1}.</div>
        <div class="lb-name">${escapeHTML(entry.name)}</div>
        <div class="lb-stats">🌱 ${entry.plantsCut || 0} cortadas</div>
        <div class="lb-score">${entry.score} pts</div>
      `;
      listContainer.appendChild(row);
    });
  }
}

function escapeHTML(str) {
  return (str || '').replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[m]);
}

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas');
  const game = new FloraGame(canvas);
  const ui = new UIManager();
  ui.setGame(game);
  window.floraGame = game;
  window.uiManager = ui;
});
