// Function to load and display projects from JSON file
async function loadProjects() {
	const container = document.getElementById('projects-container');
	const jsonPath = container.dataset.json;
    
    try {
        // Fetch the projects from the JSON file
        const response = await fetch(jsonPath);
        
        if (!response.ok) {
            throw new Error('Failed to load projects');
        }
        
        const data = await response.json();
        const projects = data.projects;
        container.innerHTML = '';
        
		// create card
        projects.forEach(project => {
            const col = document.createElement('div');
            col.className = 'col-md-6 col-lg-4';
            
            const tags = project.tags.map(tag => 
                `<span class="badge bg-secondary me-1 mb-1">${tag}</span>`
            ).join('');
            
			let mediaContent = '';
            if (project.video) {
                // Check if it's a YouTube URL
                const youtubeMatch = project.video.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
                if (youtubeMatch) {
                    // YouTube embed
                    mediaContent = `
                        <div class="ratio ratio-16x9">
                            <iframe src="https://www.youtube.com/embed/${youtubeMatch[1]}" 
                                    title="${project.title}" 
                                    frameborder="0" 
                                    allowfullscreen>
                            </iframe>
                        </div>
                    `;
                } else {
                    // Local video file
                    mediaContent = `
                        <video class="card-img-top" controls>
                            <source src="${project.video}" type="video/mp4">
                            Your browser does not support the video tag.
                        </video>
                    `;
                }
            } else if (project.image) {
                mediaContent = `<img src="${project.image}" class="card-img-top" alt="${project.title}">`;
            }

			col.innerHTML = `
                <div class="card project-card shadow-sm">
                    ${mediaContent}
                    <div class="card-body d-flex flex-column">
                        <h5 class="card-title">${project.title}</h5>
                        <p class="card-text">${project.description}</p>
                        <div class="mt-auto">
                            <div class="mb-3">
                                ${tags}
                            </div>
                            <div class="d-flex flex-wrap gap-2">
                                ${project.link ? `<a href="${project.link}" class="btn btn-primary" target="_blank">View Project</a>` : ''}
                                ${project.source ? `<a href="${project.source}" class="btn btn-outline-dark" target="_blank">Source</a>` : ''}
                                ${project.credit ? `<a href="${project.credit}" class="btn btn-outline-secondary" target="_blank">Image Credit</a>` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            `;
            container.appendChild(col);
        });
        
    } catch (error) {
        console.error('Error loading projects:', error);
        container.innerHTML = `
            <div class="col-12">
                <div class="alert alert-danger" role="alert">
                    Failed to load projects @ '${jsonPath}'
                </div>
            </div>
        `;
    }
}

// Smooth scrolling for navigation links
document.addEventListener('DOMContentLoaded', function() {
    // Load projects
    loadProjects();
    
    // Add active class to nav links on scroll
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.navbar-nav .nav-link');
    
    window.addEventListener('scroll', () => {
        let current = '';
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;
            if (scrollY >= (sectionTop - 200)) {
                current = section.getAttribute('id');
            }
        });
        
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href').substring(1) === current) {
                link.classList.add('active');
            }
        });
    });
});
