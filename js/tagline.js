let taglineElement = document.getElementById('tagline');

async function OnAwake() {
    const response = await fetch('data/tagline.json');
    if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const tags = await response.json();

    taglineElement.textContent = tags[Math.floor(Math.random() * tags.length)];
}

window.onload = OnAwake;