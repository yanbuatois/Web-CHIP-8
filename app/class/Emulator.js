import config from '../config';

export default class Emulator {
  /**
   * Create an emulator
   * @param {Blob} file Read file
   */
  constructor(file) {
    this.file = file;
    this.canvas = document.getElementById('chip8-canvas');
    this.beeper = document.getElementById('beep-audio');
    this.canvas.height = config.height * config.factor;
    this.canvas.width = config.width * config.factor;
    this.lock = false;
    /**
     * @type {CanvasRenderingContext2D}
     */
    this.context = this.canvas.getContext('2d');
    if (!this.context) {
      this.handleError(new Error('Your navigator must support 2D canvas to use this emulator.'));
      return;
    }
    // this.context.enable();
    new Response(file).arrayBuffer().then(result => this.startEmulation(result), error => this.handleError(error));
  }

  /**
   * The emulation starts while the file is loaded.
   * @param {ArrayBuffer} result The file buffer
   */
  startEmulation(result) {
    this.buffer = result;
    this.delayTimer = 0;
    this.soundTimer = 0;
    this.opcode = 0;
    this.pc = 0x200;
    this.I = 0;
    this.wasBlocked = false;
    this.blocked = false;
    this.unblockKey = 0;
    this.superRoutines = [];
    this.shouldDraw = false;
    this.keys = new Array(16).fill(false);
    this.ram = new Array(4096).fill(0);
    this.registers = new Array(16).fill(0);
    this.matrix = [];
    for (let i = 0; i < config.width; ++i) {
      this.matrix.push(new Array(config.height).fill(0));
    }
    const array8 = new Uint8Array(this.buffer);
    array8.forEach((val, index) => {
      this.ram[0x200 + index] = val;
    });
    for (let i = 0x50; i <= 0xA0; ++i) {
      const data = [0xF0, 0x90, 0x90, 0x90, 0xF0, // 0
        0x20, 0x60, 0x20, 0x20, 0x70, // 1
        0xF0, 0x10, 0xF0, 0x80, 0xF0, // 2
        0xF0, 0x10, 0xF0, 0x10, 0xF0, // 3
        0x90, 0x90, 0xF0, 0x10, 0x10, // 4
        0xF0, 0x80, 0xF0, 0x10, 0xF0, // 5
        0xF0, 0x80, 0xF0, 0x90, 0xF0, // 6
        0xF0, 0x10, 0x20, 0x40, 0x40, // 7
        0xF0, 0x90, 0xF0, 0x90, 0xF0, // 8
        0xF0, 0x90, 0xF0, 0x10, 0xF0, // 9
        0xF0, 0x90, 0xF0, 0x90, 0x90, // A
        0xE0, 0x90, 0xE0, 0x90, 0xE0, // B
        0xF0, 0x80, 0x80, 0x80, 0xF0, // C
        0xE0, 0x90, 0x90, 0x90, 0xE0, // D
        0xF0, 0x80, 0xF0, 0x80, 0xF0, // E
        0xF0, 0x80, 0xF0, 0x80, 0x80]; // F
      this.ram[i] = data[i - 0x50];
    }
    this.clear();
    this.registerKeyboardEvents();
    setInterval(() => this.gameLoop(), (1 / 60) * 1000);
  }

  keyToKeyboard(id) {
    switch (id) {
      case 49:
        return 1;
      case 50:
        return 2;
      case 51:
        return 3;
      case 52:
        return 0xC;
      case 81:
        return 4;
      case 87:
        return 5;
      case 69:
        return 6;
      case 82:
        return 0xD;
      case 65:
        return 7;
      case 83:
        return 8;
      case 68:
        return 9;
      case 70:
        return 0xE;
      case 90:
        return 0xA;
      case 88:
        return 0;
      case 67:
        return 0xB;
      case 66:
        return 0xF;
      default:
        return false;
    }
  }

  registerKeyboardEvents() {
    this.canvas.addEventListener('keydown', (event) => {
      event.preventDefault();
      console.log(event);
      this.blocked = false;
      const key = this.keyToKeyboard(event.keyCode);
      this.unblockKey = key;
      if (key !== false) {
        this.keys[key] = true;
      }
    });

    this.canvas.addEventListener('keyup', (event) => {
      event.preventDefault();
      const key = this.keyToKeyboard(event.keyCode);
      if (key !== false) {
        this.keys[key] = false;
      }
    });
  }

  clear() {
    this.matrix = [];
    for (let i = 0; i < config.width; ++i) {
      this.matrix.push(new Array(config.height).fill(0));
    }
    this.shouldDraw = true;
  }

  beep() {
    this.beeper.currentTime = 0;
    this.beeper.play();
  }

  gameLoop() {
    this.tickLogic();
    this.tickDraw();
    // setTimeout(() => this.gameLoop(), (1 / 60) * 1000);
    // setImmediate(() => this.gameLoop());
  }

  tickDraw() {
    if (!this.shouldDraw) {
      return;
    }
    const matrixSize = this.matrix.length;
    for (let i = 0; i < matrixSize; ++i) {
      const row = this.matrix[i];
      const rowSize = row.length;
      for (let j = 0; j < rowSize; ++j) {
        const element = row[j];
        const x = i * config.factor;
        const y = j * config.factor;
        this.context.fillStyle = element ? '#FFFFFF' : '#000000';
        this.context.fillRect(x, y, config.factor, config.factor);
      }
    }

    // console.log(this.matrix);
    this.shouldDraw = false;
  }

  delayTimerEnded() {

  }

  soundTimerEnded() {
    this.beep();
  }

  tickLogic() {
    this.beeper.pause();
    if (this.delayTimer) {
      --this.delayTimer;
      if (this.delayTimer) {
        this.delayTimerEnded();
      }
    }
    if (this.soundTimer) {
      --this.soundTimer;
      if (this.soundTimer) {
        this.soundTimerEnded();
      }
    }

    this.opcode = (this.ram[this.pc] << 8) | this.ram[this.pc + 1];
    if (this.interpretOpcode()) {
      this.pc += 2;
    }
  }

  interpretOpcode() {
    let dontContinue = false;
    let nbRegister1, nbRegister2, compare1, compare2, store1, store2;
    switch ((this.opcode & 0xF000) >> (4 * 3)) {
      // Jump to address
      case 0x1:
        this.pc = this.opcode & 0x0FFF;
        dontContinue = true;
        break;
      // Calls subroutine
      case 0x2:
        this.superRoutines.push(this.pc);
        this.pc = this.opcode & 0x0FFF;
        dontContinue = true;
        break;
      // Jump if VX == NN
      case 0x3:
        nbRegister1 = (this.opcode & 0x0F00) >> (4 * 2);
        compare1 = this.registers[nbRegister1];
        compare2 = this.opcode & 0x00FF;
        this.pc += (compare1 === compare2) ? 2 : 0;
        break;
      // Jump if VX != NN
      case 0x4:
        nbRegister1 = (this.opcode & 0x0F00) >> (4 * 2);
        compare1 = this.registers[nbRegister1];
        compare2 = this.opcode & 0x00FF;
        this.pc += (compare1 !== compare2) ? 2 : 0;
        break;
      // Jump if VX != VY
      case 0x5:
        nbRegister1 = (this.opcode & 0x0F00) >> (4 * 2);
        compare1 = this.registers[nbRegister1];
        nbRegister2 = (this.opcode & 0x00F0) >> 4;
        compare2 = this.registers[nbRegister2];
        this.pc += (compare1 === compare2) ? 2 : 0;
        break;
      // VX = NN
      case 0x6:
        nbRegister1 = (this.opcode & 0x0F00) >> (4 * 2);
        this.registers[nbRegister1] = this.opcode & 0x00FF;
        break;

      case 0x7:
        nbRegister1 = (this.opcode & 0x0F00) >> (4 * 2);
        store1 = this.opcode & 0x00FF;
        this.registers[nbRegister1] += store1;
        this.registers[nbRegister1] &= 0xff;
        break;

      case 0x8:
        nbRegister1 = (this.opcode & 0x0F00) >> (4 * 2);
        nbRegister2 = (this.opcode & 0x00F0) >> 4;
        switch (this.opcode & 0xf00f) {
          case 0x8000:
            this.registers[nbRegister1] = this.registers[nbRegister2];
            break;
          case 0x8001:
            this.registers[nbRegister1] = this.registers[nbRegister1] | this.registers[nbRegister2];
            break;
          case 0x8002:
            this.registers[nbRegister1] = this.registers[nbRegister1] & this.registers[nbRegister2];
            break;
          case 0x8003:
            this.registers[nbRegister1] = this.registers[nbRegister1] ^ this.registers[nbRegister2];
            break;
          case 0x8004:
            this.registers[nbRegister1] += this.registers[nbRegister2];
            if (this.registers[nbRegister1] > 0xFF) {
              this.registers[nbRegister1] = this.registers[nbRegister1] & 0xff;
              this.registers[0xF] = 1;
            } else {
              this.registers[0xF] = 0;
            }
            break;
          case 0x8005:
            this.registers[nbRegister1] -= this.registers[nbRegister2];
            if (this.registers[nbRegister1] < 0) {
              this.registers[nbRegister1] = this.registers[nbRegister1] & 0xff;
              this.registers[0xF] = 1;
            } else {
              this.registers[0xF] = 0;
            }
            break;
          case 0x8006:
            this.registers[0xF] = this.registers[nbRegister1] & 0b1;
            this.registers[nbRegister1] >>= 1;
            break;
          case 0x8007:
            this.registers[nbRegister1] = this.registers[nbRegister2] - this.registers[nbRegister1];
            if (this.registers[nbRegister1] < 0) {
              this.registers[nbRegister1] = this.registers[nbRegister1] & 0xff;
              this.registers[0xF] = 1;
            } else {
              this.registers[0xF] = 0;
            }
            break;
          case 0x800e:
            this.registers[0xF] = this.registers[nbRegister1] & (0x80);
            this.registers[nbRegister1] <<= 1;
            break;
          default:
            this.handleError(new Error(`Unknown opcode (0x${this.opcode.toString(16)})`));
        }
        break;

      case 0x9:
        nbRegister1 = (this.opcode & 0x0F00) >> (4 * 2);
        compare1 = this.registers[nbRegister1];
        nbRegister2 = (this.opcode & 0x00F0) >> 4;
        compare2 = this.registers[nbRegister2];
        this.pc += (compare1 !== compare2) ? 2 : 0;
        break;

      // Set memory value to I.
      case 0xA:
        this.I = this.opcode & 0x0FFF;
        break;

      case 0xB:
        this.pc = this.registers[0] + (this.opcode & 0x0FFF);
        dontContinue = true;
        break;

      case 0xC:
        nbRegister1 = (this.opcode & 0x0F00) >> (4 * 2);
        store1 = this.opcode & 0x00FF;
        store2 = Math.floor(Math.random() * 0xff);
        this.registers[nbRegister1] = store2 & store1;
        break;

      case 0xD:
        (() => {
          const xRegAdd = (this.opcode & 0x0F00) >> (4 * 2);
          const yRegAdd = (this.opcode & 0x0F0) >> 4;
          const height = this.opcode & 0x000F;
          const width = 8;

          const startX = this.registers[xRegAdd];
          const startY = this.registers[yRegAdd];
          const endX = startX + width;
          const endY = startY + height;

          this.registers[0xF] = 0;

          for (let x = startX; x < endX && x < this.matrix.length; ++x) {
            const column = this.matrix[x];

            for (let y = startY; y < endY && y < column.length; ++y) {
              const pixels = this.ram[this.I + (y - startY)];
              const pixel = (pixels & (0x80 >> (x - startX)));
              const currentPixel = column[y];
              if (pixel && currentPixel) {
                this.registers[0xF] = 1;
              }
              // console.log(currentPixel ^ (pixel) ? 1 : 0);
              this.matrix[x][y] ^= (pixel ? 1 : 0);
            }

            // console.log(this.matrix[startX][startY]);
          }
          this.shouldDraw = true;
        })();
        break;

      default:
        switch (this.opcode & 0xF0FF) {
          // Clear screen
          case 0x00E0:
            this.clear();
            break;
          // Return from subroutine
          case 0x00EE:
            this.pc = this.superRoutines.pop();
            break;
          case 0xE09E:
            nbRegister1 = (this.opcode & 0x0F00) >> (4 * 2);
            compare1 = this.registers[nbRegister1];
            this.pc += this.keys[compare1] ? 2 : 0;
            break;
          case 0xE0A1:
            nbRegister1 = (this.opcode & 0x0F00) >> (4 * 2);
            compare1 = this.registers[nbRegister1];
            this.pc += this.keys[compare1] ? 0 : 2;
            break;
          case 0xF007:
            nbRegister1 = (this.opcode & 0x0F00) >> (4 * 2);
            this.registers[nbRegister1] = this.delayTimer;
            break;
          case 0xF00A:
            if (this.blocked || !this.wasBlocked) {
              this.wasBlocked = true;
              this.blocked = true;
              dontContinue = true;
            } else {
              nbRegister1 = (this.opcode & 0x0F00) >> (4 * 2);
              this.registers[nbRegister1] = this.unblockKey;
              this.wasBlocked = false;
            }
            break;

          case 0xF015:
            nbRegister1 = (this.opcode & 0x0F00) >> (4 * 2);
            store1 = this.registers[nbRegister1];
            this.delayTimer = store1;
            break;
          case 0xF018:
            nbRegister1 = (this.opcode & 0x0F00) >> (4 * 2);
            store1 = this.registers[nbRegister1];
            this.soundTimer = store1;
            break;
          case 0xF01E:
            nbRegister1 = (this.opcode & 0x0F00) >> (4 * 2);
            this.I += this.registers[nbRegister1];
            if (this.I > 0xFFF) {
              this.I &= 0xFFF;
              this.registers[0xF] = 1;
            } else {
              this.registers[0xF] = 0;
            }
            break;

          case 0xF029:
            nbRegister1 = (this.opcode & 0x0F00) >> (4 * 2);
            store1 = this.registers[nbRegister1];
            this.I = 0x50 + (store1 * 5);
            break;

          case 0xF033:
            nbRegister1 = (this.opcode & 0x0F00) >> (4 * 2);
            store1 = this.registers[nbRegister1];
            this.ram[this.I] = Math.floor(store1 / 100);
            this.ram[this.I + 1] = Math.floor((store1 % 100) / 10);
            this.ram[this.I + 2] = store1 % 10;
            break;

          case 0xF055:
            nbRegister2 = (this.opcode & 0x0F00) >> (4 * 2);
            for (let i = 0; i <= nbRegister2; ++i) {
              this.ram[this.I + i] = this.registers[i];
            }
            break;

          case 0xF065:
            nbRegister2 = (this.opcode & 0x0F00) >> (4 * 2);
            for (let i = 0; i <= nbRegister2; ++i) {
              this.registers[i] = this.ram[this.I + i];
            }
            break;

          default:
            this.handleError(new Error(`Unknown opcode (0x${this.opcode.toString(16)})`));
        }
    }
    return !dontContinue;
  }

  /**
   * Handle an error.
   * @param {Error} err The error
   */
  handleError(err) {
    const element = document.getElementById('errors');
    element.innerText = err.message;
    element.classList.remove('d-none');
    console.error(err);
  }
}
