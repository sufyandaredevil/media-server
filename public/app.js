const mediaExtensions = ['.mp4', '.mkv', '.webm', '.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.alac'];

// Global state
let currentChildren = [];
let currentFilter = '';
let currentPath = '';
let currentPlaylist = [];
const lsCache = new Map(); // path -> { etag, children }

function renderNode(node) {
  const escPath = node.path.replace(/'/g, "\\'");
  const escName = node.name.replace(/'/g, "\\'");
  const escSubs = (node.subtitles || "").replace(/'/g, "\\'");

  if (node.isDirectory) {
    return `
            <details ontoggle="handleFolderToggle(this, '${escPath}')">
                <summary>
                    <span class="icon">📁</span>
                    <span class="folder-link" onclick="event.stopPropagation(); event.preventDefault(); loadPath('${escPath}');">${node.name}</span>
                </summary>
                <div class="folder-content">
                    <div class="loading-indicator">Loading...</div>
                </div>
            </details>
        `;
  } else {
    const isMedia = mediaExtensions.includes(node.ext);
    if (isMedia) {
      return `
                <a class="file-item" href="#" onclick="playMedia(this, '${escPath}', '${escName}', '${escSubs}'); return false;">
                    <span class="icon">${['.mp4', '.mkv', '.webm'].includes(node.ext) ? '🎬' : '🎵'}</span>
                    ${node.name}
                </a>
            `;
    }
    return `
                <a class="file-item" href="/stream/${encodeURIComponent(node.path)}" download="${escName}">
                    <span class="icon">📄</span>${node.name}
                </a>
            `;
  }
}

async function handleFolderToggle(details, relPath) {
  if (!details.open) return;
  const contentDiv = details.querySelector('.folder-content');
  if (!contentDiv.querySelector('.loading-indicator')) return;
  if (details.dataset.loading === 'true') return;

  const cached = lsCache.get(relPath) || {};
  details.dataset.loading = 'true';
  try {
    const response = await fetch('/api/ls', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'If-None-Match': cached.etag || ''
      },
      body: JSON.stringify({ path: relPath })
    });

    if (response.status === 401 || response.url.includes('/login')) return window.location.reload();

    if (response.status === 304 && cached.children) {
      contentDiv.innerHTML = cached.children.map(child => renderNode(child)).join('');
      return;
    }

    const children = await response.json();
    const etag = response.headers.get('ETag');
    if (etag) lsCache.set(relPath, { etag, children });

    contentDiv.innerHTML = children.length === 0
      ? '<div class="loading-indicator">Empty</div>'
      : children.map(child => renderNode(child)).join('');
  } catch (err) {
    contentDiv.innerHTML = '<div class="loading-indicator" style="color: red;">Error loading contents</div>';
  } finally {
    delete details.dataset.loading;
  }
}

function updateBreadcrumbs(relPath) {
  const container = document.getElementById('breadcrumbs');
  if (!container) return;

  const parts = relPath ? relPath.split('/') : [];
  let html = `<span class="breadcrumb-item" onclick="loadPath('')">Root</span>`;

  let tempPath = '';
  parts.forEach((part, index) => {
    tempPath += (index === 0 ? '' : '/') + part;
    html += ` <span class="breadcrumb-separator">/</span> <span class="breadcrumb-item" onclick="loadPath('${tempPath.replace(/'/g, "\\'")}')">${part}</span>`;
  });

  container.innerHTML = html;
}

const refreshTree = () => {
  const rootTree = document.getElementById('root-tree');
  const filtered = currentChildren.filter(c => c.name.toLowerCase().includes(currentFilter.toLowerCase()));
  rootTree.innerHTML = filtered.length === 0
    ? `<div class="loading-indicator">${currentFilter ? 'No matches' : 'Empty'}</div>`
    : filtered.map(child => renderNode(child)).join('');

  // Handle Back Button
  const backContainer = document.getElementById('back-button-container');
  if (currentPath && !currentFilter) {
    const parentPath = currentPath.includes('/')
      ? currentPath.substring(0, currentPath.lastIndexOf('/'))
      : '';
    backContainer.innerHTML = `<button class="back-button" onclick="loadPath('${parentPath.replace(/'/g, "\\'")}')">Go back</button>`;
    backContainer.style.display = 'block';
  } else {
    backContainer.style.display = 'none';
  }
};

async function loadPath(relPath) {
  const rootTree = document.getElementById('root-tree');
  const searchInput = document.getElementById('explorer-search');

  rootTree.innerHTML = '<div class="loading-indicator">Loading...</div>';
  searchInput.value = '';
  currentFilter = '';
  currentPath = relPath;

  const cached = lsCache.get(relPath) || {};

  try {
    const response = await fetch('/api/ls', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'If-None-Match': cached.etag || ''
      },
      body: JSON.stringify({ path: relPath })
    });

    if (response.status === 401 || response.url.includes('/login')) return window.location.reload();

    if (response.status === 304 && cached.children) {
      currentChildren = cached.children;
      refreshTree();
      updateBreadcrumbs(relPath);
      return;
    }

    currentChildren = await response.json();
    const etag = response.headers.get('ETag');
    if (etag) lsCache.set(relPath, { etag, children: currentChildren });

    refreshTree();
    updateBreadcrumbs(relPath);
  } catch (err) {
    rootTree.innerHTML = '<div class="loading-indicator" style="color: red;">Error loading path</div>';
  }
}

function playMedia(element, relPath, fileName, subtitlePath) {
  const section = document.getElementById('player-section');
  const ext = fileName.split('.').pop().toLowerCase();
  const isVideo = ['mp4', 'mkv', 'webm'].includes(ext);
  const mimeMap = {
    'mp4': 'video/mp4', 'mkv': 'video/x-matroska', 'webm': 'video/webm',
    'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'ogg': 'audio/ogg',
    'm4a': 'audio/mp4', 'aac': 'audio/aac', 'flac': 'audio/flac', 'alac': 'audio/alac'
  };
  const mime = mimeMap[ext] || (isVideo ? 'video/mp4' : 'audio/mpeg');

  // Update playlist if the element was manually clicked (or if no playlist exists)
  if (element) {
    currentPlaylist = currentChildren.filter(child => !child.isDirectory && mediaExtensions.includes(child.ext));
  }

  const subsEnabled = localStorage.getItem('mex_subtitles_enabled') !== 'false';

  let trackTag = '';
  if (subtitlePath && isVideo) {
    trackTag = `<track label="Subtitles" kind="subtitles" srclang="en" src="/stream/${encodeURIComponent(subtitlePath)}" ${subsEnabled ? 'default' : ''}>`;
  }

  const playerTag = isVideo
    ? `<video controls autoplay>${trackTag}<source src="/stream/${encodeURIComponent(relPath)}" type="${mime}"></video>`
    : `<audio controls autoplay><source src="/stream/${encodeURIComponent(relPath)}" type="${mime}"></audio>`;

  section.innerHTML = `
        <div class="video-wrapper ${!isVideo ? 'is-audio' : ''}">
            ${playerTag}
        </div>
        <div class="file-title">${fileName}</div>
    `;

  const media = section.querySelector(isVideo ? 'video' : 'audio');
  if (media) {
    const savedVolume = localStorage.getItem('mex_volume');
    const savedMuted = localStorage.getItem('mex_muted');
    if (savedVolume !== null) media.volume = parseFloat(savedVolume);
    if (savedMuted !== null) media.muted = savedMuted === 'true';

    media.addEventListener('volumechange', () => {
      localStorage.setItem('mex_volume', media.volume);
      localStorage.setItem('mex_muted', media.muted);
    });

    if (isVideo && subtitlePath) {
      if (media.textTracks) {
        media.textTracks.addEventListener('change', () => {
          const isShowing = Array.from(media.textTracks).some(t => t.mode === 'showing');
          localStorage.setItem('mex_subtitles_enabled', isShowing);
        });
      }
    }

    // Autoplay Next Logic
    media.addEventListener('ended', () => {
      const currentIndex = currentPlaylist.findIndex(item => item.path === relPath);
      if (currentIndex !== -1 && currentIndex < currentPlaylist.length - 1) {
        const nextItem = currentPlaylist[currentIndex + 1];
        // Try to find the element in the UI to highlight it, but play regardless
        const nextElement = document.querySelector(`.file-item[onclick*="${nextItem.path.replace(/'/g, "\\'")}"]`);
        playMedia(nextElement, nextItem.path, nextItem.name, nextItem.subtitles);
      }
    });
  }

  document.querySelectorAll('.file-item').forEach(el => el.classList.remove('active'));
  if (element) {
    element.classList.add('active');
    element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

// Initial load
document.addEventListener('DOMContentLoaded', async () => {
  const searchInput = document.getElementById('explorer-search');

  // Resize logic
  const resizer = document.getElementById('resizer');
  const explorer = document.querySelector('.explorer');
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const sidebarShow = document.getElementById('sidebar-show');

  const savedWidth = localStorage.getItem('mex_explorer_width');
  const isCollapsed = localStorage.getItem('mex_explorer_collapsed') === 'true';

  if (savedWidth) {
    explorer.style.setProperty('--explorer-width', savedWidth + 'px');
  }

  if (isCollapsed && window.innerWidth > 768) {
    explorer.classList.add('collapsed');
    sidebarShow.style.display = 'flex';
  }

  const toggleSidebar = (show) => {
    if (show) {
      explorer.classList.remove('collapsed');
      sidebarShow.style.display = 'none';
      localStorage.setItem('mex_explorer_collapsed', 'false');
    } else {
      explorer.classList.add('collapsed');
      sidebarShow.style.display = 'flex';
      localStorage.setItem('mex_explorer_collapsed', 'true');
    }
  };

  sidebarToggle.addEventListener('click', () => toggleSidebar(false));
  sidebarShow.addEventListener('click', () => toggleSidebar(true));

  resizer.addEventListener('mousedown', (e) => {
    e.preventDefault();
    document.body.style.cursor = 'col-resize';
    resizer.classList.add('resizing');

    const doDrag = (e) => {
      const newWidth = e.clientX;
      if (newWidth > 150 && newWidth < window.innerWidth * 0.8) {
        explorer.style.setProperty('--explorer-width', newWidth + 'px');
        localStorage.setItem('mex_explorer_width', newWidth);
      }
    };

    const stopDrag = () => {
      document.body.style.cursor = '';
      resizer.classList.remove('resizing');
      window.removeEventListener('mousemove', doDrag);
      window.removeEventListener('mouseup', stopDrag);
    };

    window.addEventListener('mousemove', doDrag);
    window.addEventListener('mouseup', stopDrag);
  });


  searchInput.addEventListener('input', (e) => {
    currentFilter = e.target.value;
    refreshTree();
  });

  loadPath('');
});
