import Emulator from './class/Emulator';

let emulator = null;
window.addEventListener('load', () => {
  const romSelector = document.getElementById('rom-file');
  document.getElementById('rom-loader').addEventListener('submit', (event) => {
    event.preventDefault();
    if (romSelector.files.length < 1) {
      return;
    }
    document.getElementById('rom-loader-btn').disabled = true;
    emulator = new Emulator(romSelector.files[0]);
  });
});
