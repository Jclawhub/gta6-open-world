// Keyboard and mouse input. Tracks held keys and the mouse position in screen space,
// plus edge-triggered "just pressed" keys the game loop consumes each frame.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = { x: 0, y: 0, down: false, movedAt: 0 };
    this.canvas = canvas;
    this.onKeyDown = (event) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
        event.preventDefault();
      }
      const key = event.key.toLowerCase();
      if (!this.keys.has(key)) this.pressed.add(key);
      this.keys.add(key);
    };
    this.onKeyUp = (event) => {
      this.keys.delete(event.key.toLowerCase());
    };
    this.onMouseMove = (event) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = event.clientX - rect.left;
      this.mouse.y = event.clientY - rect.top;
      this.mouse.movedAt = performance.now();
    };
    this.onMouseDown = (event) => {
      this.onMouseMove(event);
      this.mouse.down = true;
      if (event.button === 0) this.pressed.add('mouse0');
    };
    this.onMouseUp = () => {
      this.mouse.down = false;
    };
    this.onBlur = () => {
      this.keys.clear();
      this.mouse.down = false;
    };
    this.onContextMenu = (event) => event.preventDefault();
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    canvas.addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('mousedown', this.onMouseDown);
    canvas.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('mouseup', this.onMouseUp);
  }

  down(key) {
    return this.keys.has(key.toLowerCase());
  }

  // Mouse aim: the angle from a screen point (sx, sy) to the mouse, or null
  // when the mouse has not moved in the last 3 seconds (fall back to facing).
  aimAngle(sx, sy) {
    if (performance.now() - this.mouse.movedAt > 3000) return null;
    return Math.atan2(this.mouse.y - sy, this.mouse.x - sx);
  }

  justPressed(key) {
    return this.pressed.has(key.toLowerCase());
  }

  // WASD / arrow movement vector, normalised.
  moveVector() {
    let x = 0;
    let y = 0;
    if (this.down('a') || this.down('arrowleft')) x -= 1;
    if (this.down('d') || this.down('arrowright')) x += 1;
    if (this.down('w') || this.down('arrowup')) y -= 1;
    if (this.down('s') || this.down('arrowdown')) y += 1;
    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.SQRT2;
      x *= inv;
      y *= inv;
    }
    return { x, y };
  }

  endFrame() {
    this.pressed.clear();
  }

  // Drop every held key (used when the game pauses or loses focus mid-press).
  clear() {
    this.keys.clear();
    this.pressed.clear();
    this.mouse.down = false;
  }

  dispose() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.canvas.removeEventListener('mousemove', this.onMouseMove);
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
    window.removeEventListener('mouseup', this.onMouseUp);
  }
}
