/**
 * Almacenamiento local persistente para Flora: Ayúdala a mantener la calma
 * Guarda y recupera los 10 mejores puntajes en localStorage
 */
class ScoreStorage {
  constructor() {
    this.STORAGE_KEY = 'flora_juego_mejores_puntajes';
    this.LAST_NAME_KEY = 'flora_ultimo_nombre_jugador';
    this._initDefaults();
  }

  _initDefaults() {
    if (!localStorage.getItem(this.STORAGE_KEY)) {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify([]));
      return;
    }

    try {
      const storedScores = JSON.parse(localStorage.getItem(this.STORAGE_KEY));
      if (Array.isArray(storedScores)) {
        const realScores = storedScores.filter(entry => Number.isFinite(entry.timestamp));
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(realScores));
      }
    } catch (e) {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify([]));
    }
  }

  getLeaderboard() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (!data) return [];
      const scores = JSON.parse(data);
      if (!Array.isArray(scores)) return [];
      // Ordenar de mayor a menor puntaje
      return scores
        .filter(entry => Number.isFinite(entry.timestamp))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
    } catch (e) {
      console.error('Error al leer leaderboard:', e);
      return [];
    }
  }

  saveScore(name, score, plantsCut = 0, entanglements = 0, maxCombo = 1) {
    const cleanName = (name || '').trim().toUpperCase();
    if (!cleanName) {
      return { success: false, message: 'El nombre no puede estar vacío.' };
    }

    try {
      const current = this.getLeaderboard();
      const today = new Date();
      const dateStr = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;

      const newEntry = {
        name: cleanName,
        score: Number.isFinite(score) ? score : 0,
        plantsCut,
        entanglements,
        maxCombo,
        date: dateStr,
        timestamp: Date.now()
      };

      current.push(newEntry);
      current.sort((a, b) => b.score - a.score);

      // Guardar lista completa
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(current));
      this.setLastName(cleanName);

      const rank = current.findIndex(e => e.timestamp === newEntry.timestamp) + 1;
      return { success: true, rank, isTop10: rank <= 10 };
    } catch (e) {
      console.error('Error al guardar puntaje:', e);
      return { success: false, message: 'No se pudo guardar en el almacenamiento local.' };
    }
  }

  getLastName() {
    return localStorage.getItem(this.LAST_NAME_KEY) || '';
  }

  setLastName(name) {
    if (name && name.trim()) {
      localStorage.setItem(this.LAST_NAME_KEY, name.trim());
    }
  }

  clearLeaderboard() {
    localStorage.removeItem(this.STORAGE_KEY);
    this._initDefaults();
  }
}

window.scoreStorage = new ScoreStorage();
