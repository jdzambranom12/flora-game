/**
 * Ciclo de vida y comportamiento de las plantas (ansiedad)
 * Etapa 1: Brote (No cortable)
 * Etapa 2: Planta Crecida (Cortable)
 * Etapa 3: Se acerca a Flora
 */

const PLANT_TYPES = {
  NORMAL: {
    id: 'normal',
    name: 'Brote Silvestre',
    points: 10,
    baseGrowthTime: 2.6, // Segundos para madurar
    baseSpeed: 55,       // Píxeles por segundo hacia Flora
    radius: 34,
    color: '#34A853',
    leafColor: '#2D8B46',
    budColor: '#81C784'
  },
  FAST: {
    id: 'fast',
    name: 'Zarza Ágil',
    points: 20,
    baseGrowthTime: 1.6,
    baseSpeed: 95,
    radius: 28,
    color: '#7CB342',
    leafColor: '#558B2F',
    budColor: '#AED581'
  },
  BIG: {
    id: 'big',
    name: 'Planta Frondosa',
    points: 30,
    baseGrowthTime: 3.2,
    baseSpeed: 45,
    radius: 46,
    color: '#1B5E20',
    leafColor: '#2E7D32',
    budColor: '#4CAF50'
  }
};

class Plant {
  /**
   * @param {Object} typeInfo - Tipo de planta de PLANT_TYPES
   * @param {number} spawnX - Coordenada X inicial
   * @param {number} spawnY - Coordenada Y inicial
   * @param {number} targetX - Posición de Flora X
   * @param {number} targetY - Posición de Flora Y
   * @param {number} growthSpeedMultiplier - Modificador por fase de dificultad
   * @param {number} moveSpeedMultiplier - Modificador por fase de dificultad
   */
  constructor(typeInfo, spawnX, spawnY, targetX, targetY, growthSpeedMultiplier = 1.0, moveSpeedMultiplier = 1.0) {
    this.type = typeInfo;
    this.x = spawnX;
    this.y = spawnY;
    this.originX = spawnX;
    this.originY = spawnY;
    this.targetX = targetX;
    this.targetY = targetY;

    // Etapas: 1 = BROTE, 2 = CRECIDA, 3 = ACERCÁNDOSE
    this.stage = 1;
    this.growthProgress = 0; // 0.0 a 1.0
    this.growthDuration = Math.max(0.6, this.type.baseGrowthTime / growthSpeedMultiplier);
    this.speed = this.type.baseSpeed * moveSpeedMultiplier;

    this.canBeCut = false;
    this.isDead = false;
    this.reachedFlora = false;

    this.radius = this.type.radius;
    this.sparkleTimer = 0;
    this.wobbleAngle = Math.random() * Math.PI * 2;
    this.pulseAnim = 0;

    // Sonido al brotar
    if (window.audioManager) {
      window.audioManager.playBrotePop();
    }
  }

  update(dt) {
    if (this.isDead || this.reachedFlora) return;

    this.wobbleAngle += dt * 3.5;
    this.pulseAnim += dt * 5;

    // ETAPA 1: BROTE (No cortable)
    if (this.stage === 1) {
      this.growthProgress += dt / this.growthDuration;
      if (this.growthProgress >= 1.0) {
        this.growthProgress = 1.0;
        this.stage = 2; // Pasa a Crecida
        this.canBeCut = true;

        if (window.audioManager) {
          window.audioManager.playPlantMature();
        }
      }
      return;
    }

    // ETAPA 2 & 3: CORTABLE Y ACERCÁNDOSE A FLORA
    // Apenas madura, comienza a avanzar de inmediato hacia Flora
    this.stage = 3;
    this.canBeCut = true;

    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.hypot(dx, dy);

    // Radio de espacio personal de Flora donde se produce el enredo
    const floraHitRadius = 55;

    if (dist <= floraHitRadius) {
      this.reachedFlora = true;
      this.canBeCut = false;
      return;
    }

    // Movimiento hacia Flora
    const step = this.speed * dt;
    if (dist > 0) {
      this.x += (dx / dist) * Math.min(step, dist);
      this.y += (dy / dist) * Math.min(step, dist);
    }
  }

  /**
   * Comprueba si un segmento de swipe (p1 -> p2) corta la planta
   */
  checkCutIntersection(p1, p2) {
    if (!this.canBeCut || this.isDead || this.reachedFlora) return false;

    // Distancia del punto (this.x, this.y) al segmento de recta p1-p2
    const dist = distToSegment(this.x, this.y, p1.x, p1.y, p2.x, p2.y);
    return dist <= this.radius * 1.15;
  }

  draw(ctx) {
    if (this.isDead) return;

    ctx.save();

    // Dibujar tallo/enredadera que conecta con el punto de origen
    this._drawStemTrail(ctx);

    // Dibujar montículo de tierra en el origen
    this._drawOriginMound(ctx);

    if (this.stage === 1) {
      this._drawSproutStage(ctx);
    } else {
      this._drawMatureStage(ctx);
    }

    ctx.restore();
  }

  _drawOriginMound(ctx) {
    ctx.save();
    ctx.fillStyle = '#6D4C41';
    ctx.beginPath();
    ctx.ellipse(this.originX, this.originY, 14, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#8D6E63';
    ctx.beginPath();
    ctx.ellipse(this.originX, this.originY - 2, 9, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _drawStemTrail(ctx) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(this.originX, this.originY);

    // Curva bezier orgánica con ligero arqueo
    const midX = (this.originX + this.x) / 2 + Math.sin(this.wobbleAngle) * 12;
    const midY = (this.originY + this.y) / 2 + Math.cos(this.wobbleAngle) * 12;
    ctx.quadraticCurveTo(midX, midY, this.x, this.y);

    ctx.strokeStyle = this.type.leafColor;
    const stemWidth = (this.stage === 1) ? (2 + this.growthProgress * 2.5) : 5.5;
    ctx.lineWidth = stemWidth;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Pequeñas hojas laterales a lo largo del tallo
    if (this.stage > 1 || this.growthProgress > 0.5) {
      const leafCount = Math.floor(Math.hypot(this.x - this.originX, this.y - this.originY) / 45);
      for (let i = 1; i <= leafCount; i++) {
        const t = i / (leafCount + 1);
        const lx = (1 - t) * (1 - t) * this.originX + 2 * (1 - t) * t * midX + t * t * this.x;
        const ly = (1 - t) * (1 - t) * this.originY + 2 * (1 - t) * t * midY + t * t * this.y;
        const side = (i % 2 === 0 ? 1 : -1);

        ctx.fillStyle = this.type.color;
        ctx.beginPath();
        ctx.ellipse(lx + side * 6, ly, 7, 4, side * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  _drawSproutStage(ctx) {
    const scale = 0.35 + this.growthProgress * 0.65;
    ctx.translate(this.x, this.y);
    ctx.scale(scale, scale);

    // Anillo medidor de crecimiento sutil
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 0.95, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * this.growthProgress));
    ctx.strokeStyle = 'rgba(255, 235, 59, 0.7)';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // Indicador visual "NO CORTAR / BROTANDO"
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 0.75, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fill();

    // Brote tierno / capullo
    ctx.fillStyle = this.type.budColor;
    ctx.beginPath();
    ctx.ellipse(-4, -6, 8, 14, -0.3, 0, Math.PI * 2);
    ctx.ellipse(4, -6, 8, 14, 0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#AED581';
    ctx.beginPath();
    ctx.arc(0, -4, 6, 0, Math.PI * 2);
    ctx.fill();

    // Gota de rocío brillante
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.beginPath();
    ctx.arc(-2, -9, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Etiqueta sutil de brote
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Brote', 0, 24);
  }

  _drawMatureStage(ctx) {
    ctx.translate(this.x, this.y);

    const distToFlora = Math.hypot(this.targetX - this.x, this.targetY - this.y);
    const isUrgent = distToFlora < 140;

    // Resplandor de corte ("¡CORTABLE!")
    const glowRadius = this.radius * (1.1 + Math.sin(this.pulseAnim) * 0.12);
    const grad = ctx.createRadialGradient(0, 0, this.radius * 0.3, 0, 0, glowRadius);
    if (isUrgent) {
      grad.addColorStop(0, 'rgba(255, 82, 82, 0.35)');
      grad.addColorStop(1, 'rgba(255, 82, 82, 0)');
    } else {
      grad.addColorStop(0, 'rgba(129, 199, 132, 0.45)');
      grad.addColorStop(1, 'rgba(129, 199, 132, 0)');
    }
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    // Aura de resplandor listo para cortar
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.strokeStyle = isUrgent ? '#FF5252' : '#FFD54F';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Hojas maduras expandidas
    const leafCount = this.type.id === 'big' ? 5 : 4;
    for (let i = 0; i < leafCount; i++) {
      const angle = (i * (Math.PI * 2 / leafCount)) + Math.sin(this.wobbleAngle) * 0.15;
      ctx.save();
      ctx.rotate(angle);

      ctx.fillStyle = this.type.leafColor;
      ctx.beginPath();
      ctx.ellipse(this.radius * 0.52, 0, this.radius * 0.48, this.radius * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();

      // Vena de la hoja
      ctx.strokeStyle = this.type.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(this.radius * 0.8, 0);
      ctx.stroke();

      ctx.restore();
    }

    // Núcleo central
    ctx.fillStyle = this.type.color;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 0.42, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FFF59D';
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Destellos animados
    const spX = Math.cos(this.pulseAnim * 1.5) * (this.radius * 0.6);
    const spY = Math.sin(this.pulseAnim * 1.5) * (this.radius * 0.6);
    drawSparkle(ctx, spX, spY, 5);

    // Texto de alerta o cortar
    ctx.fillStyle = isUrgent ? '#FF5252' : '#FFFFFF';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(isUrgent ? '¡ALERTA!' : '¡CORTA!', 0, this.radius + 14);
  }
}

/**
 * Representa una mitad de planta cortada que vuela con física
 */
class SlicedPlantPiece {
  constructor(x, y, radius, color, leafColor, sliceAngle, isLeftHalf) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.color = color;
    this.leafColor = leafColor;
    this.sliceAngle = sliceAngle;
    this.isLeftHalf = isLeftHalf;

    // Impulso perpendicular al corte
    const pushAngle = sliceAngle + (isLeftHalf ? -Math.PI / 2 : Math.PI / 2);
    const speed = 160 + Math.random() * 120;
    this.vx = Math.cos(pushAngle) * speed;
    this.vy = Math.sin(pushAngle) * speed - 50; // Ligero salto hacia arriba
    this.rot = Math.random() * Math.PI * 2;
    this.rotSpeed = (Math.random() - 0.5) * 12;
    this.alpha = 1.0;
    this.life = 0.65; // Duración en segundos
    this.maxLife = 0.65;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vy += 380 * dt; // Gravedad suave
    this.rot += this.rotSpeed * dt;
    this.life -= dt;
    this.alpha = Math.max(0, this.life / this.maxLife);
  }

  draw(ctx) {
    if (this.alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);

    ctx.fillStyle = this.color;
    ctx.beginPath();
    // Medio círculo cortado
    ctx.arc(0, 0, this.radius, this.sliceAngle, this.sliceAngle + Math.PI);
    ctx.closePath();
    ctx.fill();

    // Borde brillante de corte
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(Math.cos(this.sliceAngle) * this.radius, Math.sin(this.sliceAngle) * this.radius);
    ctx.lineTo(Math.cos(this.sliceAngle + Math.PI) * this.radius, Math.sin(this.sliceAngle + Math.PI) * this.radius);
    ctx.stroke();

    ctx.restore();
  }
}

/**
 * Partículas de hojas y polen que explotan al cortar
 */
class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.color = color;
    const angle = Math.random() * Math.PI * 2;
    const speed = 70 + Math.random() * 180;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.size = 3 + Math.random() * 5;
    this.alpha = 1.0;
    this.life = 0.45 + Math.random() * 0.35;
    this.maxLife = this.life;
    this.rot = Math.random() * Math.PI;
    this.rotSpeed = (Math.random() - 0.5) * 8;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vy += 120 * dt; // Gravedad
    this.rot += this.rotSpeed * dt;
    this.life -= dt;
    this.alpha = Math.max(0, this.life / this.maxLife);
  }

  draw(ctx) {
    if (this.alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.fillStyle = this.color;
    // Forma de hojita
    ctx.beginPath();
    ctx.ellipse(0, 0, this.size, this.size * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/**
 * Texto flotante de puntaje (+10, +20, COMBO x2)
 */
class FloatingText {
  constructor(text, x, y, color = '#FFD54F', fontSize = 22, isCombo = false) {
    this.text = text;
    this.x = x;
    this.y = y;
    this.color = color;
    this.fontSize = fontSize;
    this.isCombo = isCombo;
    this.life = 0.9;
    this.maxLife = 0.9;
    this.vy = -55;
    this.scale = isCombo ? 1.4 : 1.1;
  }

  update(dt) {
    this.y += this.vy * dt;
    this.life -= dt;
    if (this.scale > 1.0) {
      this.scale = Math.max(1.0, this.scale - dt * 2);
    }
  }

  draw(ctx) {
    if (this.life <= 0) return;
    const alpha = Math.min(1.0, this.life / (this.maxLife * 0.35));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(this.x, this.y);
    ctx.scale(this.scale, this.scale);

    ctx.font = `bold ${this.fontSize}px 'Outfit', 'Montserrat', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Sombra gruesa para legibilidad
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.lineWidth = 4;
    ctx.strokeText(this.text, 0, 0);

    ctx.fillStyle = this.color;
    ctx.fillText(this.text, 0, 0);

    ctx.restore();
  }
}

// Funciones auxiliares geométricas
function distToSegment(px, py, x1, y1, x2, y2) {
  const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * (x2 - x1);
  const projY = y1 + t * (y2 - y1);
  return Math.hypot(px - projX, py - projY);
}

function drawSparkle(ctx, x, y, size) {
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.quadraticCurveTo(x, y, x + size, y);
  ctx.quadraticCurveTo(x, y, x, y + size);
  ctx.quadraticCurveTo(x, y, x - size, y);
  ctx.quadraticCurveTo(x, y, x, y - size);
  ctx.fill();
  ctx.restore();
}

window.PLANT_TYPES = PLANT_TYPES;
window.Plant = Plant;
window.SlicedPlantPiece = SlicedPlantPiece;
window.Particle = Particle;
window.FloatingText = FloatingText;
