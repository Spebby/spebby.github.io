/** Renders the project cards from the JSON file named by each [data-projects] container. */

export interface Project {
  readonly title: string;
  readonly description: string;
  readonly tags: readonly string[];
  readonly image?: string;
  readonly video?: string;
  readonly link?: string;
  readonly source?: string;
  readonly credit?: string;
}

const YOUTUBE_ID =
  /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/;

const ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);
}

function optionalString(
  record: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

/** Validates one entry of the JSON file; returns null if it is not a usable project. */
export function parseProject(raw: unknown): Project | null {
  if (typeof raw !== "object" || raw === null) return null;
  const record = raw as Record<string, unknown>;

  const title = optionalString(record, "title");
  const description = optionalString(record, "description");
  if (title === undefined || description === undefined) return null;

  const tags = Array.isArray(record.tags)
    ? record.tags.filter((tag): tag is string => typeof tag === "string")
    : [];

  const project: { -readonly [K in keyof Project]: Project[K] } = {
    title,
    description,
    tags,
  };
  for (const key of ["image", "video", "link", "source", "credit"] as const) {
    const value = optionalString(record, key);
    if (value !== undefined) project[key] = value;
  }
  return project;
}

function resolveUrl(path: string): string {
  const base = document.body.dataset.baseUrl;
  if (!base) throw new Error("Missing data-base-url");

  return new URL(
    path.replace(/^\/+/, ""),
    base.endsWith("/") ? base : `${base}/`,
  ).href;
}

function mediaHtml(project: Project): string {
  const title = escapeHtml(project.title);

  if (project.video) {
    const youtube = YOUTUBE_ID.exec(project.video);
    const inner = youtube?.[1]
      ? `<iframe src="https://www.youtube.com/embed/${youtube[1]}"
                title="${title}" allowfullscreen></iframe>`
      : `<video class="object-fit-cover" controls>
          <source src="${escapeHtml(project.video)}" type="video/mp4">
          Your browser does not support the video tag.
        </video>`;
    return `<div class="ratio ratio-16x9 border-bottom">${inner}</div>`;
  }

  if (project.image) {
    return `<div class="ratio ratio-16x9 border-bottom">
    <img src="${escapeHtml(resolveUrl(project.image))}" class="object-fit-cover" alt="${title}">
  </div>`;
  }

  return "";
}

function buttonHtml(
  url: string | undefined,
  label: string,
  accent: boolean,
): string {
  if (!url) return "";
  const classes = accent ? "btn tui-btn tui-btn-accent" : "btn tui-btn";
  return `<a href="${escapeHtml(url)}" class="${classes}" target="_blank">${label}</a>`;
}

function cardHtml(project: Project): string {
  const tags = project.tags
    .map(
      (tag) => `<span class="badge tui-badge me-2">${escapeHtml(tag)}</span>`,
    )
    .join("");

  return `
  <div class="card tui-card h-100">
    ${mediaHtml(project)}
    <div class="card-body d-flex flex-column">
      <h5 class="card-title fs-6 fw-semibold">${escapeHtml(project.title)}</h5>
      <p class="card-text text-body-secondary small">${escapeHtml(project.description)}</p>
      <div class="mt-auto">
        <div class="mb-3">${tags}</div>
        <div class="d-flex flex-wrap gap-2">
          ${buttonHtml(project.link, "View Project", true)}
          ${buttonHtml(project.source, "Source", false)}
          ${buttonHtml(project.credit, "Image Credit", false)}
        </div>
      </div>
    </div>
  </div>`;
}

async function loadInto(container: HTMLElement): Promise<void> {
  const url = container.dataset.projects;
  if (!url) return;

  try {
    const response = await fetch(url);
    if (!response.ok)
      throw new Error(`Failed to load projects (${response.status})`);

    const data: unknown = await response.json();
    const list =
      typeof data === "object" && data !== null
        ? (data as { projects?: unknown }).projects
        : undefined;
    if (!Array.isArray(list))
      throw new Error("Expected a { projects: [...] } object");

    container.replaceChildren();
    for (const raw of list) {
      const project = parseProject(raw);
      if (!project) continue;

      const column = document.createElement("div");
      column.className = "col-12 col-xl-4";
      column.innerHTML = cardHtml(project);
      container.appendChild(column);
    }
  } catch (error) {
    console.error("Error loading projects:", error);
    container.innerHTML = `
      <div class="col-12">
        <div class="alert tui-alert" role="alert">Failed to load projects @ '${escapeHtml(url)}'</div>
      </div>`;
  }
}

export async function loadProjects(): Promise<void> {
  const containers = Array.from(
    document.querySelectorAll<HTMLElement>("[data-projects]"),
  );
  await Promise.all(containers.map(loadInto));
}
