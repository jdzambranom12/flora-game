/**
 * Motor central del juego Flora: Ayúdala a mantener la calma
 * Mecánica de swipe-to-cut estilo Fruit Ninja, cronómetro de 60 segundos,
 * progresión de dificultad en 3 etapas estrictas y sistema de enredos.
 */

class FloraGame {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // Estado del juego
    this.isRunning = false;
    this.isPaused = false;
    this.timer = 60.0;
    this.score = 0;
    this.entanglements = 0;
    this.plantsCut = 0;
    this.playerName = 'FLORA';

    // Sistema de combos
    this.currentCombo = 0;
    this.comboTimer = 0;
    this.maxCombo = 1;

    // Plantas y entidades
    this.plants = [];
    this.spawnSequence = 0;
    this.slicedPieces = [];
    this.particles = [];
    this.floatingTexts = [];
    this.spawnTimer = 0;

    // Control de fases (0: Calma, 1: Aumento fuerte, 2: Caos)
    this.currentPhase = 0;
    this.phaseAlertText = '';
    this.phaseAlertTimer = 0;

    // Rastro de corte (Swipe trail)
    this.swipePoints = [];
    this.isPointerDown = false;
    this.lastPointerPos = null;

    // Flora y animaciones
    this.floraX = 0;
    this.floraY = 0;
    this.floraBreathingTime = 0;
    this.floraShake = 0;

    // Sprites cargados de Flora
    this.floraImages = {};
    this.imagesLoaded = false;
    this._loadFloraAssets();

    // Eventos de entrada
    this._bindEvents();
    this.resize();

    // Loop
    this.lastTimestamp = 0;
  }

  _loadFloraAssets() {
    const assetList = {
      tranquila: 'assets/flora_tranquila.png',
      molesta: 'assets/flora_molesta.png',
      irritada: 'assets/flora_irritada.png',
      abrumada: 'assets/flora_abrumada.png',
      enredada: 'assets/flora_enredada.png',
      victoriosa: 'assets/flora_victoriosa.png'
    };

    let loadedCount = 0;
    const total = Object.keys(assetList).length;

    for (const [key, path] of Object.entries(assetList)) {
      const img = new Image();
      img.src = path;
      img.onload = () => {
        this.floraImages[key] = img;
        loadedCount++;
        if (loadedCount >= total) {
          this.imagesLoaded = true;
        }
      };
      img.onerror = () => {
        // Fallback to jpg si el png falla
        const fallbackImg = new Image();
        fallbackImg.src = path.replace('.png', '.jpg');
        fallbackImg.onload = () => {
          this.floraImages[key] = fallbackImg;
          loadedCount++;
          if (loadedCount >= total) this.imagesLoaded = true;
        };
        fallbackImg.onerror = () => {
          loadedCount++;
          if (loadedCount >= total) this.imagesLoaded = true;
        };
      };
    }
  }

  /**
   * Elimina el fondo blanco de los sprites para que Flora se integre naturalmente
   */
  _processImageTransparency(img) {
    try {
      const offCanvas = document.createElement('canvas');
      offCanvas.width = img.naturalWidth || 800;
      offCanvas.height = img.naturalHeight || 800;
      const offCtx = offCanvas.getContext('2d');
      offCtx.drawImage(img, 0, 0);

      const imgData = offCtx.getImageData(0, 0, offCanvas.width, offCanvas.height);
      const data = imgData.data;

      // Detectar fondo blanco puro/casi blanco desde los bordes
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        if (r > 235 && g > 235 && b > 235) {
          // Desvanecer suavemente hacia el borde
          const brightness = (r + g + b) / 3;
          if (brightness > 248) {
            data[i + 3] = 0; // Transparente total
          } else {
            data[i + 3] = Math.floor((255 - brightness) * 15);
          }
        }
      }

      offCtx.putImageData(imgData, 0, 0);
      return offCanvas;
    } catch (e) {
      return img;
    }
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.resetTransform();
    this.ctx.scale(dpr, dpr);
    this.width = rect.width;
    this.height = rect.height;

    // Centrar a Flora
    this.floraX = this.width / 2;
    this.floraY = this.height / 2 + 15;
  }

  _bindEvents() {
    window.addEventListener('resize', () => this.resize());

    // Puntero unificado (mouse + táctil)
    const onDown = (e) => {
      if (!this.isRunning || this.isPaused) return;
      this.isPointerDown = true;
      const pos = this._getPointerPos(e);
      this.lastPointerPos = pos;
      this.swipePoints = [{ x: pos.x, y: pos.y, time: performance.now() }];
      if (window.audioManager) window.audioManager.ensureContext();
    };

    const onMove = (e) => {
      if (!this.isRunning || this.isPaused || !this.isPointerDown) return;
      const currentPos = this._getPointerPos(e);
      const now = performance.now();

      if (this.lastPointerPos) {
        const dx = currentPos.x - this.lastPointerPos.x;
        const dy = currentPos.y - this.lastPointerPos.y;
        const dist = Math.hypot(dx, dy);

        // Si hay movimiento suficiente, verificar corte
        if (dist > 6) {
          this._handleSwipeCut(this.lastPointerPos, currentPos);
          if (window.audioManager && dist > 18) {
            window.audioManager.playSwoosh(Math.min(2.0, dist / 25));
          }
        }
      }

      this.swipePoints.push({ x: currentPos.x, y: currentPos.y, time: now });
      this.lastPointerPos = currentPos;
    };

    const onUp = () => {
      this.isPointerDown = false;
      this.lastPointerPos = null;
    };

    this.canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }

  _getPointerPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  startGame(playerName = 'JUGADOR') {
    this.playerName = playerName.trim().toUpperCase() || 'JUGADOR';
    this.score = 0;
    this.timer = 60.0;
    this.entanglements = 0;
    this.plantsCut = 0;
    this.currentCombo = 0;
    this.maxCombo = 1;
    this.plants = [];
    this.spawnSequence = 0;
    this.slicedPieces = [];
    this.particles = [];
    this.floatingTexts = [];
    this.swipePoints = [];
    this.spawnTimer = 0.5; // Primer brote rápido
    this.currentPhase = 0;
    this.isRunning = true;
    this.isPaused = false;
    this.lastTimestamp = performance.now();

    if (window.uiManager) {
      window.uiManager.updateHUD(this.score, Math.ceil(this.timer), this.entanglements);
    }

    if (window.audioManager) {
      window.audioManager.setTensionLevel(0);
      window.audioManager.startAmbient();
    }

    requestAnimationFrame(ts => this._loop(ts));
  }

  pauseGame() {
    this.isPaused = true;
    if (window.audioManager) window.audioManager.stopAmbient();
  }

  resumeGame() {
    if (!this.isRunning) return;
    this.isPaused = false;
    this.lastTimestamp = performance.now();
    if (window.audioManager) window.audioManager.startAmbient();
    requestAnimationFrame(ts => this._loop(ts));
  }

  stopGame() {
    this.isRunning = false;
    if (window.audioManager) window.audioManager.stopAmbient();
  }

  _loop(timestamp) {
    if (!this.isRunning) return;

    if (this.isPaused) {
      this._render();
      return;
    }

    const dt = Math.min(0.1, (timestamp - this.lastTimestamp) / 1000);
    this.lastTimestamp = timestamp;

    this._update(dt);
    this._render();

    requestAnimationFrame(ts => this._loop(ts));
  }

  _update(dt) {
    // 1. Cronómetro de 60 segundos
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 0;
      this._endGame(true); // ¡Victoria! Se cumplió el tiempo
      return;
    }

    const elapsed = 60.0 - this.timer;

    // 2. Control de Dificultad Estricta
    // 0–20s: CALMA
    // 20–40s: AUMENTO FUERTE (A los 20s exactos)
    // 40–60s: MÁXIMA PRESIÓN (A los 40s exactos)
    let growthMultiplier = 1.0;
    let moveMultiplier = 1.0;
    let spawnInterval = 2.3;
    let maxPlants = 2;

    if (elapsed < 20.0) {
      // Fase 0: Calma
      const phaseProgress = elapsed / 20.0;
      if (this.currentPhase !== 0) {
        this.currentPhase = 0;
        if (window.audioManager) window.audioManager.setTensionLevel(0);
      }
      growthMultiplier = 1.0;
      moveMultiplier = 1.2;
      spawnInterval = 2.3 - phaseProgress * 0.4;
      maxPlants = 2 + Math.floor(phaseProgress * 2);
    } else if (elapsed < 40.0) {
      // Fase 1: Aumento fuerte
      const phaseProgress = (elapsed - 20.0) / 20.0;
      if (this.currentPhase !== 1) {
        this.currentPhase = 1;
        this.phaseAlertText = '¡CRECIMIENTO RÁPIDO!';
        this.phaseAlertTimer = 2.2;
        if (window.audioManager) {
          window.audioManager.playPhaseSpike('fast');
          window.audioManager.setTensionLevel(1);
        }
      }
      growthMultiplier = 2.0; // Maduran el doble de rápido
      moveMultiplier = 2.35;  // Se acercan mucho más rápido
      spawnInterval = 1.9 - phaseProgress * 0.95;
      maxPlants = 3 + Math.floor(phaseProgress * 3);
    } else {
      // Fase 2: Caos / Máxima presión
      const phaseProgress = Math.min(1, (elapsed - 40.0) / 20.0);
      if (this.currentPhase !== 2) {
        this.currentPhase = 2;
        this.phaseAlertText = '¡MÁXIMA PRESIÓN!';
        this.phaseAlertTimer = 2.4;
        if (window.audioManager) {
          window.audioManager.playPhaseSpike('chaos');
          window.audioManager.setTensionLevel(2);
        }
      }
      growthMultiplier = 3.2; // Crecimiento vertiginoso
      moveMultiplier = 3.4;   // Avance veloz
      spawnInterval = 0.95 - phaseProgress * 0.4;
      maxPlants = 5 + Math.floor(phaseProgress * 4);
    }

    // Temporizador de alerta en pantalla
    if (this.phaseAlertTimer > 0) {
      this.phaseAlertTimer -= dt;
    }

    // 3. Generación de Plantas
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      if (this.plants.length < maxPlants) {
        this._spawnPlant(growthMultiplier, moveMultiplier);
      }
      this.spawnTimer = spawnInterval * (0.8 + Math.random() * 0.4);
    }

    // 4. Actualizar Plantas
    for (let i = this.plants.length - 1; i >= 0; i--) {
      const plant = this.plants[i];
      plant.update(dt);

      // Si la planta alcanzó a Flora -> ENREDO
      if (plant.reachedFlora) {
        this._handleEntanglement(plant);
        this.plants.splice(i, 1);
      }
    }

    // 5. Actualizar Pedazos Cortados, Partículas y Textos Flotantes
    for (let i = this.slicedPieces.length - 1; i >= 0; i--) {
      this.slicedPieces[i].update(dt);
      if (this.slicedPieces[i].alpha <= 0) this.slicedPieces.splice(i, 1);
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update(dt);
      if (this.particles[i].alpha <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      this.floatingTexts[i].update(dt);
      if (this.floatingTexts[i].life <= 0) this.floatingTexts.splice(i, 1);
    }

    // 6. Temporizador de Combos
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.currentCombo = 0;
      }
    }

    // 7. Limpiar Puntos de Corte Vencidos
    const now = performance.now();
    this.swipePoints = this.swipePoints.filter(p => now - p.time < 130);

    // 8. Animación de Flora
    this.floraBreathingTime += dt;
    if (this.floraShake > 0) {
      this.floraShake = Math.max(0, this.floraShake - dt * 4);
    }

    // 9. Actualizar interfaz de usuario (HUD)
    if (window.uiManager) {
      window.uiManager.updateHUD(this.score, Math.ceil(this.timer), this.entanglements);
    }
  }

  _spawnPlant(growthMult, moveMult) {
    // Elegir tipo según fase y probabilidades
    let type = PLANT_TYPES.NORMAL;
    const r = Math.random();
    if (this.currentPhase === 0) {
      type = r < 0.75 ? PLANT_TYPES.NORMAL : PLANT_TYPES.FAST;
    } else if (this.currentPhase === 1) {
      if (r < 0.45) type = PLANT_TYPES.NORMAL;
      else if (r < 0.8) type = PLANT_TYPES.FAST;
      else type = PLANT_TYPES.BIG;
    } else {
      if (r < 0.3) type = PLANT_TYPES.NORMAL;
      else if (r < 0.65) type = PLANT_TYPES.FAST;
      else type = PLANT_TYPES.BIG;
    }

    // Posición de aparición en los bordes del círculo de juego
    const angle = Math.random() * Math.PI * 2;
    // Distancia desde el centro (cerca de los bordes pero dentro del canvas)
    const margin = 50;
    const maxRadius = Math.min(this.width / 2 - margin, this.height / 2 - margin);
    const spawnDist = Math.max(160, maxRadius);

    const spawnX = this.floraX + Math.cos(angle) * spawnDist;
    const spawnY = this.floraY + Math.sin(angle) * spawnDist;

    const phaseSpeedProfiles = [
      [0.78, 1.0, 1.22, 0.9, 1.12],
      [0.8, 1.1, 1.4, 0.95, 1.25],
      [0.72, 1.15, 1.55, 0.9, 1.35, 1.75]
    ];
    const profile = phaseSpeedProfiles[this.currentPhase];
    const speedVariation = profile[this.spawnSequence % profile.length];
    this.spawnSequence++;

    const plant = new Plant(
      type,
      spawnX,
      spawnY,
      this.floraX,
      this.floraY,
      growthMult,
      moveMult,
      speedVariation
    );
    this.plants.push(plant);
  }

  _handleSwipeCut(p1, p2) {
    let cutsInThisStroke = 0;

    for (let i = this.plants.length - 1; i >= 0; i--) {
      const plant = this.plants[i];

      // SOLO CORTA SI ESTÁ EN ETAPA 2 O 3 (MADURA)
      if (plant.checkCutIntersection(p1, p2)) {
        plant.hasBeenScored = true;
        plant.isDead = true;
        cutsInThisStroke++;
        this.plantsCut++;

        // Calcular ángulo del corte
        const cutAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

        // Generar mitades cortadas con separación física
        this.slicedPieces.push(
          new SlicedPlantPiece(plant.x, plant.y, plant.radius, plant.type.color, plant.type.leafColor, cutAngle, true),
          new SlicedPlantPiece(plant.x, plant.y, plant.radius, plant.type.color, plant.type.leafColor, cutAngle, false)
        );

        // Explosión de partículas de hojas y chispas
        for (let k = 0; k < 14; k++) {
          this.particles.push(new Particle(plant.x, plant.y, k % 2 === 0 ? plant.type.color : '#FFF59D'));
        }

        // Puntos base
        let earnedPoints = plant.type.points;

        // Gestión de Combo
        this.currentCombo++;
        this.comboTimer = 0.65; // Ventana de combo
        if (this.currentCombo > this.maxCombo) {
          this.maxCombo = this.currentCombo;
        }

        if (this.currentCombo >= 2) {
          const comboBonus = (this.currentCombo - 1) * 5;
          earnedPoints += comboBonus;

          // Mostrar texto de Combo
          this.floatingTexts.push(
            new FloatingText(`COMBO x${this.currentCombo}! +${earnedPoints}`, plant.x, plant.y - 18, '#FFEB3B', 24, true)
          );

          if (window.audioManager) {
            window.audioManager.playCombo(this.currentCombo);
          }
        } else {
          // Mostrar puntaje normal
          this.floatingTexts.push(
            new FloatingText(`+${earnedPoints}`, plant.x, plant.y - 12, '#81C784', 21, false)
          );

          if (window.audioManager) {
            window.audioManager.playSlice(1);
          }
        }

        this.score += earnedPoints;

        // Eliminar planta cortada
        this.plants.splice(i, 1);
      }
    }
  }

  _handleEntanglement(plant) {
    this.entanglements++;
    this.floraShake = 0.55; // Sacudida visual

    if (window.audioManager) {
      window.audioManager.playEntangle(this.entanglements);
    }

    // Efecto de partículas de espinas/polvo
    for (let k = 0; k < 12; k++) {
      this.particles.push(new Particle(this.floraX, this.floraY, '#6D4C41'));
    }

    // Aviso flotante de enredo
    this.floatingTexts.push(
      new FloatingText(`¡ENREDO! ${this.entanglements}/3`, this.floraX, this.floraY - 60, '#FF5252', 23, true)
    );

    // Si llega a 4 enredos: FIN INMEDIATO
    if (this.entanglements >= 4) {
      this._endGame(false); // Derrota por enredos
    }
  }

  _endGame(isWin) {
    this.stopGame();
    const finalScore = this.score;

    if (window.audioManager) {
      if (isWin) {
        window.audioManager.playVictory();
      } else {
        window.audioManager.playGameOver();
      }
    }

    if (window.uiManager) {
      window.uiManager.showResultScreen({
        isWin,
        score: finalScore,
        plantsCut: this.plantsCut,
        entanglements: this.entanglements,
        playerName: this.playerName,
        maxCombo: this.maxCombo
      });
    }
  }

  _render() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Fondo orgánico zen
    this._drawZenBackground();

    // Dibujar plantas (tallos, brotes y maduras)
    for (const plant of this.plants) {
      plant.draw(this.ctx);
    }

    // Dibujar mitades cortadas
    for (const piece of this.slicedPieces) {
      piece.draw(this.ctx);
    }

    // Dibujar a Flora en el centro con su expresión y enredos
    this._drawFlora();

    // Dibujar partículas
    for (const p of this.particles) {
      p.draw(this.ctx);
    }

    // Dibujar textos flotantes (+10, COMBO x2)
    for (const ft of this.floatingTexts) {
      ft.draw(this.ctx);
    }

    // Dibujar estela de corte (Fruit Ninja blade trail)
    this._drawSwipeTrail();

    // Alerta de cambio de fase ("¡CRECIMIENTO RÁPIDO!", "¡MÁXIMA PRESIÓN!")
    this._drawPhaseAlert();
  }

  _drawZenBackground() {
    const ctx = this.ctx;
    // Gradiente suave de jardín zen
    const grad = ctx.createRadialGradient(
      this.floraX, this.floraY, 60,
      this.floraX, this.floraY, Math.max(this.width, this.height) * 0.75
    );
    grad.addColorStop(0, '#F5F5ED');
    grad.addColorStop(0.55, '#E8EFE5');
    grad.addColorStop(1, '#DCE7D8');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);

    // Círculos zen concéntricos tenues en el suelo
    ctx.save();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(76, 175, 80, 0.12)';
    for (let r = 90; r < Math.max(this.width, this.height); r += 90) {
      ctx.beginPath();
      ctx.arc(this.floraX, this.floraY, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Líneas de jardín de arena zen
    ctx.strokeStyle = 'rgba(165, 214, 167, 0.15)';
    ctx.lineWidth = 1;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
      ctx.beginPath();
      ctx.moveTo(this.floraX, this.floraY);
      ctx.lineTo(this.floraX + Math.cos(a) * 800, this.floraY + Math.sin(a) * 800);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawFlora() {
    const ctx = this.ctx;
    ctx.save();

    // Respiración suave y sacudida si hay daño
    const breatheOffset = Math.sin(this.floraBreathingTime * 2.2) * 3;
    let shakeX = 0;
    let shakeY = 0;
    if (this.floraShake > 0) {
      shakeX = (Math.random() - 0.5) * 16 * this.floraShake;
      shakeY = (Math.random() - 0.5) * 16 * this.floraShake;
    }

    const posX = this.floraX + shakeX;
    const posY = this.floraY + breatheOffset + shakeY;

    // Esterilla / tapiz de meditación de loto bajo Flora
    ctx.save();
    ctx.fillStyle = 'rgba(200, 230, 201, 0.85)';
    ctx.beginPath();
    ctx.ellipse(posX, posY + 65, 75, 30, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#81C784';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(posX, posY + 65, 75, 30, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Pétalos de loto en la base
    ctx.fillStyle = '#C8E6C9';
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      ctx.beginPath();
      ctx.ellipse(posX + Math.cos(a) * 65, posY + 65 + Math.sin(a) * 22, 14, 8, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Determinar qué sprite usar según el nivel de enredo
    let spriteKey = 'tranquila';
    if (this.entanglements === 1) spriteKey = 'molesta';
    else if (this.entanglements === 2) spriteKey = 'irritada';
    else if (this.entanglements >= 3) spriteKey = 'abrumada';

    const sprite = this.floraImages[spriteKey];
    const size = 180; // Tamaño renderizado de Flora

    if (sprite) {
      ctx.drawImage(sprite, posX - size / 2, posY - size / 2, size, size);
    } else {
      // Fallback si la imagen aún carga
      this._drawFloraFallback(ctx, posX, posY, spriteKey);
    }

    // Dibujar enredaderas físicas superpuestas según cantidad de enredos
    this._drawEntanglementVines(ctx, posX, posY);

    ctx.restore();
  }

  _drawEntanglementVines(ctx, x, y) {
    if (this.entanglements <= 0) return;

    ctx.save();
    ctx.strokeStyle = '#2E7D32';
    ctx.fillStyle = '#4CAF50';
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';

    // Enredo 1: Envuelve las piernas y base
    if (this.entanglements >= 1) {
      ctx.beginPath();
      ctx.moveTo(x - 60, y + 60);
      ctx.bezierCurveTo(x - 30, y + 40, x + 20, y + 70, x + 50, y + 55);
      ctx.stroke();
      this._drawVineLeaf(ctx, x - 20, y + 48, 0.4);
      this._drawVineLeaf(ctx, x + 30, y + 60, -0.5);
    }

    // Enredo 2: Envuelve la cintura y un brazo
    if (this.entanglements >= 2) {
      ctx.beginPath();
      ctx.moveTo(x + 55, y + 35);
      ctx.bezierCurveTo(x + 10, y + 10, x - 40, y + 25, x - 55, y + 5);
      ctx.stroke();
      this._drawVineLeaf(ctx, x + 25, y + 20, 0.8);
      this._drawVineLeaf(ctx, x - 25, y + 18, -0.7);
    }

    // Enredo 3: Envuelve hombros y torso (alta tensión)
    if (this.entanglements >= 3) {
      ctx.beginPath();
      ctx.moveTo(x - 50, y - 10);
      ctx.bezierCurveTo(x - 20, y - 35, x + 30, y - 20, x + 48, y - 15);
      ctx.stroke();
      this._drawVineLeaf(ctx, x - 10, y - 28, 0.3);
      this._drawVineLeaf(ctx, x + 20, y - 22, -0.4);
    }

    ctx.restore();
  }

  _drawVineLeaf(ctx, lx, ly, rot) {
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.ellipse(0, 0, 8, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _drawFloraFallback(ctx, x, y, state) {
    // Dibujo de reserva mientras carga el sprite
    ctx.fillStyle = '#9E9E9E'; // Piel gris
    ctx.beginPath();
    ctx.arc(x, y - 20, 36, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#2E7D32'; // Pelo follaje
    ctx.beginPath();
    ctx.arc(x, y - 30, 42, Math.PI, Math.PI * 2);
    ctx.fill();

    // Girasoles en trenzas
    ctx.fillStyle = '#FFB300';
    ctx.beginPath();
    ctx.arc(x - 42, y, 12, 0, Math.PI * 2);
    ctx.arc(x + 42, y, 12, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawSwipeTrail() {
    if (this.swipePoints.length < 2) return;

    const ctx = this.ctx;
    const now = performance.now();

    ctx.save();
    for (let i = 1; i < this.swipePoints.length; i++) {
      const p1 = this.swipePoints[i - 1];
      const p2 = this.swipePoints[i];
      const age = now - p2.time;
      const progress = 1.0 - (age / 130);
      if (progress <= 0) continue;

      const width = 10 * progress;

      // Resplandor exterior esmeralda / dorado
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = `rgba(76, 175, 80, ${progress * 0.45})`;
      ctx.lineWidth = width * 2.2;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Filo brillante blanco / lima
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = `rgba(255, 255, 255, ${progress * 0.95})`;
      ctx.lineWidth = width;
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawPhaseAlert() {
    if (this.phaseAlertTimer <= 0) return;

    const ctx = this.ctx;
    const alpha = Math.min(1.0, this.phaseAlertTimer / 0.5);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = '900 32px "Outfit", "Montserrat", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const textY = this.height * 0.28;
    const isChaos = this.currentPhase === 2;

    // Placa de advertencia
    ctx.fillStyle = isChaos ? 'rgba(211, 47, 47, 0.88)' : 'rgba(245, 124, 0, 0.88)';
    const textWidth = ctx.measureText(this.phaseAlertText).width;
    ctx.beginPath();
    ctx.roundRect(this.floraX - textWidth / 2 - 24, textY - 26, textWidth + 48, 52, 14);
    ctx.fill();

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(this.phaseAlertText, this.floraX, textY);

    ctx.restore();
  }
}

window.FloraGame = FloraGame;
