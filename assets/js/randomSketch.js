(() => {
    const SKETCHES = ['rain', 'snow'];
    const BASE_PATH = '/assets/js/';

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src;
            s.defer = true;
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }

    async function init() {
        // Load p5 if it isn't already present
        if (typeof window.p5 === 'undefined') {
            await loadScript('https://cdn.jsdelivr.net/npm/p5@1.9.3/lib/p5.min.js');
        }

        // Pick a sketch at random
        const choice = SKETCHES[Math.floor(Math.random() * SKETCHES.length)];

        // Load the chosen sketch
        await loadScript(`${BASE_PATH}${choice}.js`);
    }

    init().catch(err => {
        console.error('Failed to initialise p5 sketch:', err);
    });
})();
