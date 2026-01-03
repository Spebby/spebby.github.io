const base = "/assets/images/backgrounds/";

async function loadBackground() {
    try {
        const res = await fetch(`${base}backgrounds.json`);
        const images = await res.json();

        if (!Array.isArray(images) || images.length === 0) return;

        const img = images[Math.floor(Math.random() * images.length)];
        document.body.style.backgroundImage =
            `url('${base}${img}')`;
		document.body.style.backgroundAttachment = 'fixed';
		document.body.style.backgroundSize = 'cover';
		document.body.style.backgroundPosition = 'center';
    } catch (e) {
        console.error('Background load failed:', e);
    }
}

document.addEventListener('DOMContentLoaded', function() {
	loadBackground();
});
