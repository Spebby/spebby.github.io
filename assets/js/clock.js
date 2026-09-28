function tick() {
  document.getElementById("clock").textContent = new Date().toLocaleTimeString(
    [],
    { hour12: false },
  );
}
tick();
setInterval(tick, 1000);
