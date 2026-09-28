// Function to load and display projects from JSON file
async function loadProjects() {
  const containers = document.querySelectorAll("#projects-container");
  for (const container of containers) {
    const jsonPath = container.dataset.json;

    try {
      // Fetch the projects from the JSON file
      const response = await fetch(jsonPath);

      if (!response.ok) {
        throw new Error("Failed to load projects");
      }

      const data = await response.json();
      const projects = data.projects;
      container.innerHTML = "";

      // create card
      projects.forEach((project) => {
        const col = document.createElement("div");
        col.className = "col-12 col-xl-4"; // see the breakpoint note below

        const tags = project.tags
          .map((tag) => `<span class="badge tui-badge me-2">${tag}</span>`)
          .join("");

        // Every media type goes in a Bootstrap .ratio box, so they all match
        let mediaContent = "";
        if (project.video) {
          const youtubeMatch = project.video.match(
            /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/,
          );
          if (youtubeMatch) {
            mediaContent = `
      <div class="ratio ratio-16x9 border-bottom">
        <iframe src="https://www.youtube.com/embed/${youtubeMatch[1]}"
                title="${project.title}" allowfullscreen></iframe>
      </div>`;
          } else {
            mediaContent = `
      <div class="ratio ratio-16x9 border-bottom">
        <video class="object-fit-cover" controls>
          <source src="${project.video}" type="video/mp4">
          Your browser does not support the video tag.
        </video>
      </div>`;
          }
        } else if (project.image) {
          mediaContent = `
    <div class="ratio ratio-16x9 border-bottom">
      <img src="${project.image}" class="object-fit-cover" alt="${project.title}">
    </div>`;
        }

        col.innerHTML = `
  <div class="card tui-card h-100">
    ${mediaContent}
    <div class="card-body d-flex flex-column">
      <h5 class="card-title fs-6 fw-semibold">${project.title}</h5>
      <p class="card-text text-body-secondary small">${project.description}</p>
      <div class="mt-auto">
        <div class="mb-3">${tags}</div>
        <div class="d-flex flex-wrap gap-2">
          ${project.link ? `<a href="${project.link}" class="btn tui-btn tui-btn-accent" target="_blank">View Project</a>` : ""}
          ${project.source ? `<a href="${project.source}" class="btn tui-btn" target="_blank">Source</a>` : ""}
          ${project.credit ? `<a href="${project.credit}" class="btn tui-btn" target="_blank">Image Credit</a>` : ""}
        </div>
      </div>
    </div>
  </div>`;
        container.appendChild(col);
      });
    } catch (error) {
      console.error("Error loading projects:", error);
      container.innerHTML = `
	  <div class="col-12">
		<div class="alert tui-alert" role="alert">Failed to load projects @ '${jsonPath}'</div>
	  </div>`;
    }
  }
}

// Smooth scrolling for navigation links
document.addEventListener("DOMContentLoaded", function () {
  // Load projects
  loadProjects();

  // Add active class to nav links on scroll
  const sections = document.querySelectorAll("section[id]");
  const navLinks = document.querySelectorAll(".navbar-nav .nav-link");

  window.addEventListener("scroll", () => {
    let current = "";

    sections.forEach((section) => {
      const sectionTop = section.offsetTop;
      const sectionHeight = section.clientHeight;
      if (scrollY >= sectionTop - 200) {
        current = section.getAttribute("id");
      }
    });

    navLinks.forEach((link) => {
      link.classList.remove("active");
      if (link.getAttribute("href").substring(1) === current) {
        link.classList.add("active");
      }
    });
  });
});
